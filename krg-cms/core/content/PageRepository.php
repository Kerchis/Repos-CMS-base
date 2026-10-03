<?php
/**
 * Page documents.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class PageRepository {

	public static function list(): array {
		$q = new \WP_Query(
			[
				'post_type'      => 'page',
				'post_status'    => [ 'publish', 'draft', 'pending', 'future', 'private' ],
				'posts_per_page' => 200,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			]
		);
		$ids = wp_list_pluck( $q->posts, 'ID' );
		if ( $ids ) {
			update_meta_cache( 'post', $ids );
		}
		$out = [];
		foreach ( $q->posts as $p ) {
			$out[] = self::summary( $p );
		}
		return $out;
	}

	public static function summary( \WP_Post $p ): array {
		$front = (int) get_option( 'page_on_front' );
		$on    = get_option( 'show_on_front' );
		return [
			'id'          => $p->ID,
			'title'       => $p->post_title,
			'slug'        => $p->post_name,
			'status'      => $p->post_status,
			'uiStatus'    => self::ui_status( $p ),
			'visibility'  => self::visibility_of( $p ),
			'hasPassword' => ( $p->post_password !== '' ),
			'isFront'     => ( 'page' === $on && $front === (int) $p->ID ),
			'parentId'    => (int) $p->post_parent,
			'modified'    => $p->post_modified,
			'link'        => get_permalink( $p ),
			'enabled'     => (bool) get_post_meta( $p->ID, MERIDIAN_META_ENABLED, true ),
		];
	}

	public static function visibility_of( \WP_Post $p ): string {
		if ( 'private' === $p->post_status ) {
			return 'private';
		}
		if ( $p->post_password !== '' ) {
			return 'protected';
		}
		return 'public';
	}

	public static function ui_status( \WP_Post $p ): string {
		if ( 'private' === $p->post_status ) {
			return 'publish';
		}
		if ( in_array( $p->post_status, [ 'draft', 'pending', 'publish' ], true ) ) {
			return $p->post_status;
		}
		return 'draft';
	}

	public static function get( int $id, string $state = 'draft' ): ?array {
		$post = get_post( $id );
		if ( ! $post || 'page' !== $post->post_type ) {
			return null;
		}
		$key = 'published' === $state ? MERIDIAN_META_PUBLISHED : MERIDIAN_META_DRAFT;
		$doc = Document::decode( get_post_meta( $id, $key, true ) );
		if ( ! $doc && 'draft' === $state ) {
			$doc = Document::decode( get_post_meta( $id, MERIDIAN_META_PUBLISHED, true ) );
		}
		if ( ! $doc ) {
			$doc = Document::empty( $id, $post->post_title, $post->post_name );
		}
		// Una pagina guardada por el sistema anterior llega aqui con el
		// fondo en `props` y los atajos de relleno sin desplegar. Se
		// traduce al leer —una sola vez, en el unico sitio por el que pasan
		// editor, «Preview» y web publica— asi que los tres ven exactamente
		// la misma estructura sin que nadie tenga que reabrir y guardar.
		$doc = \Meridian\Style\BoxStyles::migrate_document( $doc );

		$doc['id']     = $id;
		$doc['title']  = $post->post_title;
		$doc['slug']   = $post->post_name;
		$doc['status'] = $post->post_status;
		$doc['parentId'] = (int) $post->post_parent;
		$doc['checksum'] = Document::checksum( $doc );
		return $doc;
	}

	public static function create( array $payload ): array {
		$title = sanitize_text_field( $payload['title'] ?? __( 'Página sin título', 'meridian' ) );
		$slug  = sanitize_title( $payload['slug'] ?? $title );
		$id    = wp_insert_post(
			[
				'post_type'   => 'page',
				'post_status' => 'draft',
				'post_title'  => $title,
				'post_name'   => $slug,
				'post_parent' => absint( $payload['parentId'] ?? 0 ),
			],
			true
		);
		if ( is_wp_error( $id ) ) {
			throw new \RuntimeException( $id->get_error_message() );
		}
		$doc = $payload['document'] ?? Document::empty( (int) $id, $title, $slug );
		$doc['id']    = (int) $id;
		$doc['title'] = $title;
		$doc['slug']  = get_post_field( 'post_name', $id );
		$doc          = \Meridian\Security\Sanitizer::document( $doc );
		self::write_meta( (int) $id, MERIDIAN_META_DRAFT, $doc );
		update_post_meta( $id, MERIDIAN_META_ENABLED, '1' );
		RevisionRepository::add( (int) $id, 'page', $doc, 'manual' );
		return self::get( (int) $id, 'draft' );
	}

	public static function save_draft( int $id, array $doc, string $if_match = '' ): array {
		$post = get_post( $id );
		if ( ! $post || 'page' !== $post->post_type ) {
			throw new \RuntimeException( 'not_found' );
		}
		$doc       = \Meridian\Security\Sanitizer::document( $doc );
		$doc['id'] = $id;
		if ( ! empty( $doc['title'] ) && $doc['title'] !== $post->post_title ) {
			wp_update_post(
				[
					'ID'         => $id,
					'post_title' => $doc['title'],
				]
			);
		}
		if ( ! empty( $doc['slug'] ) && $doc['slug'] !== $post->post_name ) {
			wp_update_post(
				[
					'ID'        => $id,
					'post_name' => sanitize_title( $doc['slug'] ),
				]
			);
		}
		if ( isset( $doc['parentId'] ) && (int) $doc['parentId'] !== (int) $post->post_parent ) {
			wp_update_post(
				[
					'ID'          => $id,
					'post_parent' => absint( $doc['parentId'] ),
				]
			);
		}
		self::write_meta( $id, MERIDIAN_META_DRAFT, $doc );
		update_post_meta( $id, MERIDIAN_META_ENABLED, '1' );
		try {
			RevisionRepository::add( $id, 'page', $doc, 'autosave' );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
		}
		clean_post_cache( $id );
		return self::get( $id, 'draft' );
	}

	public static function publish( int $id ): array {
		$doc = self::get( $id, 'draft' );
		if ( ! $doc ) {
			throw new \RuntimeException( 'not_found' );
		}
		$doc['status'] = 'publish';
		self::write_meta( $id, MERIDIAN_META_PUBLISHED, $doc );
		self::write_meta( $id, MERIDIAN_META_DRAFT, $doc );
		wp_update_post(
			[
				'ID'          => $id,
				'post_status' => 'publish',
			]
		);
		$fresh = self::get( $id, 'published' );
		$html  = \Meridian\Render\PageRenderer::html_from_document( $fresh ?: $doc, false, $id );
		$css   = \Meridian\Style\DocumentCssCompiler::compile( $fresh ?: $doc );
		$sum   = (string) ( $fresh['checksum'] ?? \Meridian\Content\Document::checksum( $doc ) );
		\Meridian\Cache\DocumentCache::flush_page( $id );
		\Meridian\Cache\DocumentCache::put( $id, $sum, $html, $css );
		wp_update_post(
			[
				'ID'           => $id,
				'post_content' => $html,
			]
		);
		try {
			RevisionRepository::add( $id, 'page', $fresh ?: $doc, 'publish' );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
		}
		clean_post_cache( $id );
		return $fresh ?: $doc;
	}

	public static function duplicate( int $id ): array {
		$doc = self::get( $id, 'draft' );
		if ( ! $doc ) {
			throw new \RuntimeException( 'not_found' );
		}
		$doc['title']    = ( $doc['title'] ?? '' ) . ' ' . __( '(copia)', 'meridian' );
		$doc['slug']     = '';
		$doc['sections'] = self::regen_ids( $doc['sections'] ?? [] );
		unset( $doc['id'] );
		return self::create( [ 'title' => $doc['title'], 'document' => $doc ] );
	}

	public static function regen_ids( array $nodes ): array {
		foreach ( $nodes as &$n ) {
			$n['id'] = 'n_' . wp_generate_uuid4();
			if ( ! empty( $n['children'] ) ) {
				$n['children'] = self::regen_ids( $n['children'] );
			}
		}
		return $nodes;
	}

	public static function write_meta( int $id, string $key, array $doc ): void {
		$json = wp_json_encode( $doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( false === $json || ! is_string( $json ) ) {
			throw new \RuntimeException( 'encode' );
		}
		update_post_meta( $id, $key, wp_slash( $json ) );
		update_post_meta( $id, MERIDIAN_META_CHECKSUM, Document::checksum( $doc ) );
	}

	public static function delete( int $id ): bool {
		return (bool) wp_trash_post( $id );
	}

	public static function apply_settings( int $id, array $in ): array {
		$post = get_post( $id );
		if ( ! $post || 'page' !== $post->post_type ) {
			throw new \RuntimeException( __( 'Página no encontrada.', 'meridian' ) );
		}

		$can_pub = current_user_can( 'meridian_publish_pages' ) || current_user_can( 'publish_pages' );
		$status  = sanitize_key( $in['status'] ?? self::ui_status( $post ) );
		$vis     = sanitize_key( $in['visibility'] ?? self::visibility_of( $post ) );
		if ( ! in_array( $status, [ 'draft', 'pending', 'publish' ], true ) ) {
			$status = 'draft';
		}
		if ( ! in_array( $vis, [ 'public', 'protected', 'private' ], true ) ) {
			$vis = 'public';
		}

		$set_front   = array_key_exists( 'isFront', $in ) ? (bool) $in['isFront'] : null;
		$front_id    = (int) get_option( 'page_on_front' );
		$is_front    = ( 'page' === get_option( 'show_on_front' ) && $front_id === $id );
		$going_live  = ( 'publish' === $status );
		$was_live    = in_array( $post->post_status, [ 'publish', 'private' ], true );

		if ( ! $can_pub && ( $going_live || true === $set_front ) ) {
			throw new \RuntimeException( __( 'No tienes permiso para publicar.', 'meridian' ) );
		}

		if ( true === $set_front && 'publish' !== $status ) {
			throw new \RuntimeException( __( 'Publica la página antes de usarla como portada.', 'meridian' ) );
		}

		if ( $is_front && true !== $set_front && ( 'publish' !== $status || 'private' === $vis ) ) {
			throw new \RuntimeException( __( 'Esta página es la portada. Elige otra portada antes de cambiar el estado.', 'meridian' ) );
		}

		$wp_status   = $status;
		$wp_password = $post->post_password;
		if ( 'publish' === $status ) {
			if ( 'private' === $vis ) {
				$wp_status   = 'private';
				$wp_password = '';
			} elseif ( 'protected' === $vis ) {
				$wp_status = 'publish';
				if ( isset( $in['password'] ) && $in['password'] !== '' ) {
					$wp_password = sanitize_text_field( (string) $in['password'] );
				}
				if ( $wp_password === '' ) {
					throw new \RuntimeException( __( 'Escribe una contraseña para proteger la página.', 'meridian' ) );
				}
			} else {
				$wp_status   = 'publish';
				$wp_password = '';
			}
		} else {
			$wp_status = $status;
			if ( 'protected' === $vis ) {
				if ( isset( $in['password'] ) && $in['password'] !== '' ) {
					$wp_password = sanitize_text_field( (string) $in['password'] );
				}
				if ( $wp_password === '' ) {
					throw new \RuntimeException( __( 'Escribe una contraseña para proteger la página.', 'meridian' ) );
				}
			} else {
				$wp_password = '';
			}
		}

		if ( $going_live && ! $was_live ) {
			self::publish( $id );
		}

		wp_update_post(
			[
				'ID'            => $id,
				'post_status'   => $wp_status,
				'post_password' => $wp_password,
			]
		);

		if ( true === $set_front ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', $id );
		} elseif ( false === $set_front && $is_front ) {
			update_option( 'show_on_front', 'posts' );
			update_option( 'page_on_front', 0 );
		}

		clean_post_cache( $id );
		$fresh = get_post( $id );
		return $fresh ? self::summary( $fresh ) : self::summary( $post );
	}

	public static function set_front_page( int $id ): array {
		if ( $id <= 0 ) {
			update_option( 'show_on_front', 'posts' );
			update_option( 'page_on_front', 0 );
			return [ 'pageOnFront' => 0, 'showOnFront' => 'posts' ];
		}
		$post = get_post( $id );
		if ( ! $post || 'page' !== $post->post_type ) {
			throw new \RuntimeException( __( 'Página no encontrada.', 'meridian' ) );
		}
		if ( ! in_array( $post->post_status, [ 'publish', 'private' ], true ) ) {
			throw new \RuntimeException( __( 'Publica la página antes de usarla como portada.', 'meridian' ) );
		}
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $id );
		return [ 'pageOnFront' => $id, 'showOnFront' => 'page' ];
	}
}
