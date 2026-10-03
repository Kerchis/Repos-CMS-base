<?php
/**
 * REST controller.
 *
 * @package Meridian
 */

namespace Meridian\Api;

use Meridian\Content\GlobalsRepository;
use Meridian\Content\PageRepository;
use Meridian\Content\RevisionRepository;
use Meridian\Design\TokenRepository;
use Meridian\Navigation\Menus;
use Meridian\Render\Preview;
use Meridian\Seo\Head;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

defined( 'ABSPATH' ) || exit;

class Controller {

	public static function err( string $code, string $message, int $status = 400 ): WP_Error {
		return new WP_Error( $code, $message, [ 'status' => $status ] );
	}

	public static function bootstrap(): WP_REST_Response {
		$pages = PageRepository::list();
		$posts = get_posts( [ 'post_type' => 'post', 'posts_per_page' => 5, 'post_status' => [ 'publish', 'draft' ] ] );
		$recent_posts = array_map(
			static fn( $p ) => [ 'id' => $p->ID, 'title' => $p->post_title, 'status' => $p->post_status ],
			$posts
		);
		return rest_ensure_response(
			[
				'pages'     => $pages,
				'posts'     => $recent_posts,
				'counts'    => [
					'pages' => count( $pages ),
					'posts' => (int) wp_count_posts( 'post' )->publish,
					'drafts'=> count( array_filter( $pages, static fn( $p ) => 'draft' === $p['status'] ) ),
				],
				'tokens'    => TokenRepository::get(),
				'presets'   => TokenRepository::list_presets(),
				'identity'  => Menus::identity(),
				'canManage' => current_user_can( 'meridian_manage' ),
			]
		);
	}

	public static function pages_list(): WP_REST_Response {
		return rest_ensure_response( PageRepository::list() );
	}

	public static function pages_create( WP_REST_Request $req ) {
		try {
			return rest_ensure_response( PageRepository::create( $req->get_json_params() ?: [] ) );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
			return self::err( 'meridian_save', __( 'El contenido no pudo guardarse.', 'meridian' ), 500 );
		}
	}

	public static function pages_get( WP_REST_Request $req ) {
		$id  = (int) $req['id'];
		$st  = sanitize_key( $req->get_param( 'state' ) ?: 'draft' );
		$doc = PageRepository::get( $id, $st );
		if ( ! $doc ) {
			return self::err( 'meridian_not_found', __( 'Página no encontrada.', 'meridian' ), 404 );
		}
		$doc['previewUrl'] = Preview::url( $id );
		$doc['publicUrl']  = get_permalink( $id );
		return rest_ensure_response( $doc );
	}

	public static function json_body( WP_REST_Request $req ): array {
		$body = $req->get_json_params();
		if ( ! is_array( $body ) || $body === [] ) {
			$raw = $req->get_body();
			if ( is_string( $raw ) && $raw !== '' ) {
				$decoded = json_decode( $raw, true );
				if ( is_array( $decoded ) ) {
					$body = $decoded;
				}
			}
		}
		return is_array( $body ) ? $body : [];
	}

	public static function pages_save( WP_REST_Request $req ) {
		$id   = (int) $req['id'];
		$body = self::json_body( $req );
		if ( ! array_key_exists( 'sections', $body ) || ! is_array( $body['sections'] ) ) {
			return self::err( 'meridian_save', __( 'No se recibió el contenido de la página. Vuelve a pulsar Guardar.', 'meridian' ), 400 );
		}
		try {
			$doc = PageRepository::save_draft( $id, $body );
			$doc['previewUrl'] = Preview::url( $id );
			return rest_ensure_response( $doc );
		} catch ( \RuntimeException $e ) {
			if ( 'encode' === $e->getMessage() ) {
				return self::err( 'meridian_save', __( 'El contenido no se pudo convertir para guardar. Quita caracteres raros y reintenta.', 'meridian' ), 400 );
			}
			if ( 'not_found' === $e->getMessage() ) {
				return self::err( 'meridian_save', __( 'Página no encontrada.', 'meridian' ), 404 );
			}
			\Meridian\Log\Logger::error( $e->getMessage() );
			return self::err( 'meridian_save', __( 'El contenido no pudo guardarse.', 'meridian' ), 500 );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
			return self::err( 'meridian_save', __( 'El contenido no pudo guardarse.', 'meridian' ), 500 );
		}
	}

	public static function pages_publish( WP_REST_Request $req ) {
		try {
			$doc = PageRepository::publish( (int) $req['id'] );
			$doc['previewUrl'] = Preview::url( (int) $req['id'] );
			$doc['publicUrl']  = get_permalink( (int) $req['id'] );
			return rest_ensure_response( $doc );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
			return self::err( 'meridian_publish', __( 'Se produjo un error al publicar.', 'meridian' ), 500 );
		}
	}

	public static function pages_duplicate( WP_REST_Request $req ) {
		try {
			return rest_ensure_response( PageRepository::duplicate( (int) $req['id'] ) );
		} catch ( \Throwable $e ) {
			return self::err( 'meridian_save', __( 'El contenido no pudo guardarse.', 'meridian' ), 500 );
		}
	}

	public static function pages_delete( WP_REST_Request $req ) {
		PageRepository::delete( (int) $req['id'] );
		return rest_ensure_response( [ 'ok' => true ] );
	}

	public static function pages_settings( WP_REST_Request $req ) {
		try {
			return rest_ensure_response( PageRepository::apply_settings( (int) $req['id'], $req->get_json_params() ?: [] ) );
		} catch ( \RuntimeException $e ) {
			$code = ( __( 'Página no encontrada.', 'meridian' ) === $e->getMessage() ) ? 404 : 400;
			return self::err( 'meridian_page', $e->getMessage(), $code );
		} catch ( \Throwable $e ) {
			\Meridian\Log\Logger::error( $e->getMessage() );
			return self::err( 'meridian_page', __( 'No se pudo actualizar la página.', 'meridian' ), 500 );
		}
	}

	public static function site_front( WP_REST_Request $req ) {
		if ( ! current_user_can( 'meridian_publish_pages' ) && ! current_user_can( 'publish_pages' ) && ! current_user_can( 'manage_options' ) ) {
			return self::err( 'meridian_page', __( 'No tienes permiso para cambiar la portada.', 'meridian' ), 403 );
		}
		$body = $req->get_json_params() ?: [];
		try {
			return rest_ensure_response( PageRepository::set_front_page( absint( $body['pageId'] ?? 0 ) ) );
		} catch ( \RuntimeException $e ) {
			return self::err( 'meridian_page', $e->getMessage(), 400 );
		}
	}

	public static function pages_preview( WP_REST_Request $req ) {
		return rest_ensure_response( [ 'url' => Preview::url( (int) $req['id'] ) ] );
	}

	public static function revisions_list( WP_REST_Request $req ) {
		return rest_ensure_response( RevisionRepository::list( (int) $req['id'] ) );
	}

	public static function revisions_restore( WP_REST_Request $req ) {
		try {
			return rest_ensure_response( RevisionRepository::restore( (int) $req['id'], (int) $req['rid'] ) );
		} catch ( \Throwable $e ) {
			return self::err( 'meridian_restore', __( 'No se pudo restaurar la revisión.', 'meridian' ), 500 );
		}
	}

	public static function registry(): WP_REST_Response {
		return rest_ensure_response( \Meridian\Components\Registry::public_list() );
	}

	public static function tokens_get(): WP_REST_Response {
		$res = rest_ensure_response(
			[
				'data'    => TokenRepository::get(),
				'presets' => TokenRepository::list_presets(),
				'fonts'   => \Meridian\Design\FontCatalog::list(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	public static function tokens_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		$saved = TokenRepository::save( $body );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		$res = rest_ensure_response(
			[
				'data'    => $saved,
				'presets' => TokenRepository::list_presets(),
				'fonts'   => \Meridian\Design\FontCatalog::list(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	/**
	 * Guarda la paleta actual (o la que llegue en el cuerpo) como preset
	 * propio, para poder volver a ella luego.
	 */
	public static function tokens_preset_save( WP_REST_Request $req ) {
		$body   = self::json_body( $req );
		$tokens = is_array( $body['tokens'] ?? null ) && $body['tokens']
			? $body['tokens']
			: ( TokenRepository::get()['tokens'] ?? [] );

		$saved = \Meridian\Design\PresetStore::save(
			(string) ( $body['name'] ?? '' ),
			$tokens,
			(string) ( $body['slug'] ?? '' )
		);
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		$res = rest_ensure_response(
			[
				'preset'  => $saved,
				'data'    => TokenRepository::get(),
				'presets' => TokenRepository::list_presets(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	public static function tokens_preset_delete( WP_REST_Request $req ) {
		$done = \Meridian\Design\PresetStore::delete( (string) $req['slug'] );
		if ( is_wp_error( $done ) ) {
			return $done;
		}
		$res = rest_ensure_response(
			[
				'deleted' => true,
				'data'    => TokenRepository::get(),
				'presets' => TokenRepository::list_presets(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	/**
	 * Colores del propio panel. No tocan el sitio público.
	 */
	public static function admin_skin_get(): WP_REST_Response {
		$res = rest_ensure_response(
			[
				'data'     => \Meridian\Admin\Skin::get(),
				'defaults' => \Meridian\Admin\Skin::defaults(),
				'suggest'  => \Meridian\Admin\Skin::from_tokens(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	public static function admin_skin_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		$data = ! empty( $body['reset'] )
			? \Meridian\Admin\Skin::reset()
			: \Meridian\Admin\Skin::save( is_array( $body['colors'] ?? null ) ? $body['colors'] : [] );
		$res = rest_ensure_response(
			[
				'data'     => $data,
				'defaults' => \Meridian\Admin\Skin::defaults(),
				'suggest'  => \Meridian\Admin\Skin::from_tokens(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	public static function tokens_preset( WP_REST_Request $req ) {
		$saved = TokenRepository::activate_preset( (string) $req['slug'] );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		$res = rest_ensure_response(
			[
				'data'    => $saved,
				'presets' => TokenRepository::list_presets(),
				'fonts'   => \Meridian\Design\FontCatalog::list(),
			]
		);
		$res->header( 'Cache-Control', 'no-store, no-cache, must-revalidate' );
		return $res;
	}

	public static function menus_get(): WP_REST_Response {
		return rest_ensure_response( Menus::all() );
	}

	public static function menus_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		$list = [];
		if ( isset( $body['menus'] ) && is_array( $body['menus'] ) ) {
			$list = $body['menus'];
		} elseif ( is_array( $body ) && $body && array_key_exists( 0, $body ) ) {
			$list = $body;
		}
		if ( ! $list ) {
			return self::err( 'meridian_save', __( 'No se recibió el menú. Vuelve a pulsar Guardar.', 'meridian' ), 400 );
		}
		return rest_ensure_response( Menus::save( $list ) );
	}

	public static function header_get(): WP_REST_Response {
		return rest_ensure_response( Menus::header() );
	}

	public static function header_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		if ( ! $body ) {
			return self::err( 'meridian_save', __( 'No se recibió el header. Vuelve a pulsar Guardar.', 'meridian' ), 400 );
		}
		return rest_ensure_response( Menus::save_header( $body ) );
	}

	public static function footer_get(): WP_REST_Response {
		return rest_ensure_response( Menus::footer() );
	}

	public static function footer_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		if ( ! $body ) {
			return self::err( 'meridian_save', __( 'No se recibió el footer. Vuelve a pulsar Guardar.', 'meridian' ), 400 );
		}
		return rest_ensure_response( Menus::save_footer( $body ) );
	}

	public static function identity_get(): WP_REST_Response {
		$i               = Menus::identity();
		$i['logoUrl']    = ! empty( $i['logoId'] ) ? wp_get_attachment_image_url( (int) $i['logoId'], 'medium' ) : '';
		$i['faviconUrl'] = ! empty( $i['faviconId'] ) ? wp_get_attachment_image_url( (int) $i['faviconId'], 'thumbnail' ) : '';
		return rest_ensure_response( $i );
	}

	public static function identity_save( WP_REST_Request $req ) {
		$body = self::json_body( $req );
		if ( ! $body ) {
			return self::err( 'meridian_save', __( 'No se recibió la identidad. Vuelve a pulsar Guardar.', 'meridian' ), 400 );
		}
		return rest_ensure_response( Menus::save_identity( $body ) );
	}

	public static function onboard( WP_REST_Request $req ) {
		$body     = $req->get_json_params() ?: [];
		$identity = Menus::save_identity(
			[
				'siteName'  => $body['siteName'] ?? '',
				'tagline'   => $body['tagline'] ?? '',
				'logoId'    => $body['logoId'] ?? 0,
				'faviconId' => $body['faviconId'] ?? 0,
			]
		);
		$tokens = TokenRepository::get();
		if ( ! empty( $body['colors'] ) && is_array( $body['colors'] ) ) {
			$tokens = TokenRepository::patch_colors( $body['colors'] );
		}
		$header = Menus::header();
		if ( isset( $body['ctaText'] ) || isset( $body['ctaUrl'] ) ) {
			$header = Menus::save_header(
				array_merge(
					$header,
					[
						'ctaText' => $body['ctaText'] ?? $header['ctaText'],
						'ctaUrl'  => $body['ctaUrl'] ?? $header['ctaUrl'],
						'logoId'  => $identity['logoId'] ?: ( $header['logoId'] ?? 0 ),
					]
				)
			);
		}
		$front = (int) get_option( 'page_on_front' );
		if ( $front && ! empty( $body['heroTitle'] ) ) {
			$doc = PageRepository::get( $front, 'draft' );
			if ( $doc ) {
				foreach ( $doc['sections'] ?? [] as &$section ) {
					foreach ( $section['children'] ?? [] as &$child ) {
						if ( ( $child['type'] ?? '' ) === 'hero' ) {
							$child['props']['title']    = sanitize_text_field( $body['heroTitle'] );
							if ( isset( $body['heroSubtitle'] ) ) {
								$child['props']['subtitle'] = sanitize_textarea_field( $body['heroSubtitle'] );
							}
							if ( ! empty( $body['siteName'] ) ) {
								$child['props']['eyebrow'] = sanitize_text_field( $body['siteName'] );
							}
						}
					}
				}
				unset( $section, $child );
				PageRepository::save_draft( $front, $doc );
				PageRepository::publish( $front );
			}
		}
		return rest_ensure_response(
			[
				'ok'       => true,
				'identity' => $identity,
				'tokens'   => $tokens,
				'header'   => $header,
			]
		);
	}

	public static function seo_get(): WP_REST_Response {
		$s               = Head::get_global();
		$s['ogImageUrl'] = ! empty( $s['ogImageId'] ) ? wp_get_attachment_image_url( (int) $s['ogImageId'], 'medium' ) : '';
		$s['sitemapUrl'] = home_url( '/sitemap.xml' );
		$s['robotsUrl']  = home_url( '/robots.txt' );
		return rest_ensure_response( $s );
	}

	public static function seo_save( WP_REST_Request $req ) {
		return rest_ensure_response( Head::save_global( $req->get_json_params() ?: [] ) );
	}

	public static function settings_get(): WP_REST_Response {
		$s = get_option( MERIDIAN_OPTION_SETTINGS, [ 'debug' => false ] );
		$s = is_array( $s ) ? $s : [ 'debug' => false ];
		$s['caps'] = [];
		foreach ( \Meridian\Admin\Capabilities::get_matrix() as $slug => $caps ) {
			$s['caps'][] = [
				'role'    => \Meridian\Admin\Users::role_label( $slug ),
				'manage'  => in_array( 'meridian_manage', $caps, true ),
				'pages'   => in_array( 'meridian_edit_pages', $caps, true ),
				'publish' => in_array( 'meridian_publish_pages', $caps, true ),
				'blog'    => in_array( $slug, [ 'administrator', 'editor' ], true ) ? 'todas' : ( 'author' === $slug ? 'propias' : 'no' ),
			];
		}
		return rest_ensure_response( $s );
	}

	public static function settings_save( WP_REST_Request $req ) {
		$data = self::json_body( $req );
		$out  = [ 'debug' => ! empty( $data['debug'] ) ];
		update_option( MERIDIAN_OPTION_SETTINGS, $out, false );
		return rest_ensure_response( $out );
	}

	public static function cache_flush(): WP_REST_Response {
		$r = \Meridian\Cache\DocumentCache::flush_all();
		return rest_ensure_response(
			[
				'ok'      => true,
				'pages'   => (int) ( $r['pages'] ?? 0 ),
				'message' => __( 'Caché borrada. Recarga la web para ver los últimos cambios.', 'meridian' ),
			]
		);
	}

	public static function globals_list(): WP_REST_Response {
		return rest_ensure_response( GlobalsRepository::list( 'meridian_global' ) );
	}

	public static function globals_save( WP_REST_Request $req ) {
		return rest_ensure_response( GlobalsRepository::save( 'meridian_global', $req->get_json_params() ?: [] ) );
	}

	public static function globals_update( WP_REST_Request $req ) {
		return rest_ensure_response( GlobalsRepository::save( 'meridian_global', $req->get_json_params() ?: [], (int) $req['id'] ) );
	}

	public static function globals_delete( WP_REST_Request $req ) {
		GlobalsRepository::delete( (int) $req['id'] );
		return rest_ensure_response( [ 'ok' => true ] );
	}

	public static function templates_list(): WP_REST_Response {
		return rest_ensure_response( GlobalsRepository::list( 'meridian_template' ) );
	}

	public static function templates_save( WP_REST_Request $req ) {
		return rest_ensure_response( GlobalsRepository::save( 'meridian_template', $req->get_json_params() ?: [] ) );
	}

	public static function templates_delete( WP_REST_Request $req ) {
		GlobalsRepository::delete( (int) $req['id'] );
		return rest_ensure_response( [ 'ok' => true ] );
	}

	public static function blog_list(): WP_REST_Response {
		$args = [
			'post_type'      => 'post',
			'post_status'    => [ 'publish', 'draft', 'pending', 'future' ],
			'posts_per_page' => 100,
		];
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			$args['author'] = get_current_user_id();
		}
		$q = get_posts( $args );
		$out = [];
		foreach ( $q as $p ) {
			$out[] = [
				'id'      => $p->ID,
				'title'   => $p->post_title,
				'slug'    => $p->post_name,
				'status'  => $p->post_status,
				'date'    => $p->post_date,
				'excerpt' => $p->post_excerpt,
			];
		}
		return rest_ensure_response( $out );
	}

	public static function blog_get( WP_REST_Request $req ) {
		$p = get_post( (int) $req['id'] );
		if ( ! $p || 'post' !== $p->post_type ) {
			return self::err( 'meridian_not_found', __( 'Entrada no encontrada.', 'meridian' ), 404 );
		}
		if ( ! current_user_can( 'edit_post', $p->ID ) ) {
			return self::err( 'meridian_forbidden', __( 'No tienes permiso para editar esta entrada.', 'meridian' ), 403 );
		}
		$seo = get_post_meta( $p->ID, '_meridian_seo', true );
		return rest_ensure_response(
			[
				'id'              => $p->ID,
				'title'           => $p->post_title,
				'subtitle'        => get_post_meta( $p->ID, '_meridian_subtitle', true ),
				'slug'            => $p->post_name,
				'status'          => $p->post_status,
				'content'         => $p->post_content,
				'excerpt'         => $p->post_excerpt,
				'date'            => $p->post_date,
				'featuredImageId' => (int) get_post_thumbnail_id( $p ),
				'categories'      => wp_get_post_categories( $p->ID ),
				'tags'            => wp_get_post_tags( $p->ID, [ 'fields' => 'ids' ] ),
				'author'          => (int) $p->post_author,
				'seo'             => is_array( $seo ) ? $seo : [],
			]
		);
	}

	public static function blog_create( WP_REST_Request $req ) {
		$body   = $req->get_json_params() ?: [];
		$status = sanitize_key( $body['status'] ?? 'draft' );
		if ( 'publish' === $status && ! current_user_can( 'publish_posts' ) ) {
			$status = 'pending';
		}
		$id = wp_insert_post(
			[
				'post_type'    => 'post',
				'post_status'  => $status,
				'post_title'   => sanitize_text_field( $body['title'] ?? __( 'Sin título', 'meridian' ) ),
				'post_content' => \Meridian\Security\Sanitizer::post_content( (string) ( $body['content'] ?? '' ) ),
				'post_excerpt' => sanitize_textarea_field( $body['excerpt'] ?? '' ),
			],
			true
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		$req2 = new WP_REST_Request( 'GET' );
		$req2->set_url_params( [ 'id' => (int) $id ] );
		return self::blog_get( $req2 );
	}

	public static function blog_save( WP_REST_Request $req ) {
		$id = (int) $req['id'];
		if ( ! current_user_can( 'edit_post', $id ) ) {
			return self::err( 'meridian_forbidden', __( 'No tienes permiso para editar esta entrada.', 'meridian' ), 403 );
		}
		$body   = $req->get_json_params() ?: [];
		$status = sanitize_key( $body['status'] ?? 'draft' );
		if ( 'publish' === $status && ! current_user_can( 'publish_post', $id ) ) {
			$status = 'pending';
		}
		$args = [
			'ID'           => $id,
			'post_title'   => sanitize_text_field( $body['title'] ?? '' ),
			'post_content' => \Meridian\Security\Sanitizer::post_content( (string) ( $body['content'] ?? '' ) ),
			'post_excerpt' => sanitize_textarea_field( $body['excerpt'] ?? '' ),
			'post_status'  => $status,
			'post_name'    => sanitize_title( $body['slug'] ?? '' ),
		];
		if ( ! empty( $body['date'] ) ) {
			$args['post_date'] = sanitize_text_field( $body['date'] );
		}
		wp_update_post( $args );
		if ( isset( $body['featuredImageId'] ) ) {
			if ( $body['featuredImageId'] ) {
				set_post_thumbnail( $id, absint( $body['featuredImageId'] ) );
			} else {
				delete_post_thumbnail( $id );
			}
		}
		if ( isset( $body['categories'] ) ) {
			wp_set_post_categories( $id, array_map( 'absint', (array) $body['categories'] ) );
		}
		if ( isset( $body['tags'] ) ) {
			wp_set_object_terms( $id, array_map( 'absint', (array) $body['tags'] ), 'post_tag' );
		}
		if ( isset( $body['subtitle'] ) ) {
			update_post_meta( $id, '_meridian_subtitle', sanitize_text_field( $body['subtitle'] ) );
		}
		if ( isset( $body['seo'] ) && is_array( $body['seo'] ) ) {
			update_post_meta( $id, '_meridian_seo', \Meridian\Security\Sanitizer::seo( $body['seo'] ) );
		}
		return self::blog_get( $req );
	}

	public static function blog_delete( WP_REST_Request $req ) {
		$id = (int) $req['id'];
		if ( ! current_user_can( 'delete_post', $id ) ) {
			return self::err( 'meridian_forbidden', __( 'No tienes permiso para eliminar esta entrada.', 'meridian' ), 403 );
		}
		wp_trash_post( $id );
		return rest_ensure_response( [ 'ok' => true ] );
	}

	public static function blog_tax(): WP_REST_Response {
		$cats = get_categories( [ 'hide_empty' => false ] );
		$tags = get_tags( [ 'hide_empty' => false ] );
		return rest_ensure_response(
			[
				'categories' => array_map( static fn( $c ) => [ 'id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug ], $cats ),
				'tags'       => array_map( static fn( $c ) => [ 'id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug ], is_array( $tags ) ? $tags : [] ),
				'authors'    => array_map(
					static fn( $u ) => [ 'id' => $u->ID, 'name' => $u->display_name ],
					get_users( [ 'who' => 'authors' ] )
				),
			]
		);
	}

	public static function blog_term( WP_REST_Request $req ) {
		$body = $req->get_json_params() ?: [];
		$tax  = ( $body['taxonomy'] ?? 'category' ) === 'post_tag' ? 'post_tag' : 'category';
		$r    = wp_insert_term( sanitize_text_field( $body['name'] ?? '' ), $tax );
		if ( is_wp_error( $r ) ) {
			return $r;
		}
		return rest_ensure_response( [ 'id' => $r['term_id'], 'taxonomy' => $tax ] );
	}

	public static function users_list(): WP_REST_Response {
		return rest_ensure_response( \Meridian\Admin\Users::list() );
	}

	public static function users_create( WP_REST_Request $req ) {
		$out = \Meridian\Admin\Users::create( $req->get_json_params() ?: [] );
		return $out instanceof WP_Error ? $out : rest_ensure_response( $out );
	}

	public static function users_update( WP_REST_Request $req ) {
		$out = \Meridian\Admin\Users::update( (int) $req['id'], $req->get_json_params() ?: [] );
		return $out instanceof WP_Error ? $out : rest_ensure_response( $out );
	}

	public static function users_delete( WP_REST_Request $req ) {
		$out = \Meridian\Admin\Users::delete( (int) $req['id'] );
		return $out instanceof WP_Error ? $out : rest_ensure_response( $out );
	}

	public static function roles_get(): WP_REST_Response {
		return rest_ensure_response( \Meridian\Admin\Capabilities::payload() );
	}

	public static function roles_save( WP_REST_Request $req ) {
		$out = \Meridian\Admin\Capabilities::save_matrix( $req->get_json_params() ?: [] );
		return $out instanceof WP_Error ? $out : rest_ensure_response( $out );
	}

	public static function export(): WP_REST_Response {
		$pages = [];
		foreach ( PageRepository::list() as $p ) {
			$pages[] = PageRepository::get( $p['id'], 'published' ) ?: PageRepository::get( $p['id'], 'draft' );
		}
		return rest_ensure_response(
			[
				'krg'        => 1,
				'exportedAt' => gmdate( 'c' ),
				'tokens'     => TokenRepository::get(),
				'pages'      => $pages,
				'globals'    => GlobalsRepository::list( 'meridian_global' ),
				'templates'  => GlobalsRepository::list( 'meridian_template' ),
				'menus'      => Menus::all(),
				'header'     => Menus::header(),
				'footer'     => Menus::footer(),
				'settings'   => get_option( MERIDIAN_OPTION_SETTINGS, [] ),
			]
		);
	}

	public static function import( WP_REST_Request $req ) {
		$body = $req->get_json_params() ?: [];
		if ( empty( $body['krg'] ) && empty( $body['meridian'] ) ) {
			return self::err( 'meridian_import', __( 'El archivo no es un paquete KRG CMS válido.', 'meridian' ) );
		}
		if ( ! empty( $body['tokens'] ) && is_array( $body['tokens'] ) ) {
			TokenRepository::save( $body['tokens'] );
		}
		if ( ! empty( $body['menus'] ) ) {
			Menus::save( $body['menus'] );
		}
		if ( ! empty( $body['header'] ) ) {
			Menus::save_header( $body['header'] );
		}
		if ( ! empty( $body['footer'] ) ) {
			Menus::save_footer( $body['footer'] );
		}
		$created = [];
		if ( ! empty( $body['pages'] ) && is_array( $body['pages'] ) ) {
			foreach ( $body['pages'] as $page ) {
				if ( ! is_array( $page ) ) {
					continue;
				}
				try {
					if ( ! empty( $page['sections'] ) && is_array( $page['sections'] ) ) {
						$page['sections'] = PageRepository::regen_ids( $page['sections'] );
					}
					$created[] = PageRepository::create(
						[
							'title'    => $page['title'] ?? __( 'Importada', 'meridian' ),
							'slug'     => ( $page['slug'] ?? '' ) ? $page['slug'] . '-import' : '',
							'document' => $page,
						]
					);
				} catch ( \Throwable $e ) {
					\Meridian\Log\Logger::error( $e->getMessage() );
				}
			}
		}
		if ( ! empty( $body['globals'] ) && is_array( $body['globals'] ) ) {
			foreach ( $body['globals'] as $g ) {
				if ( is_array( $g ) ) {
					GlobalsRepository::save( 'meridian_global', $g );
				}
			}
		}
		if ( ! empty( $body['templates'] ) && is_array( $body['templates'] ) ) {
			foreach ( $body['templates'] as $t ) {
				if ( is_array( $t ) ) {
					GlobalsRepository::save( 'meridian_template', $t );
				}
			}
		}
		return rest_ensure_response( [ 'ok' => true, 'pages' => count( $created ) ] );
	}
}
