<?php
/**
 * Global components & templates.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class GlobalsRepository {

	public static function list( string $type = 'meridian_global' ): array {
		$q = get_posts(
			[
				'post_type'      => $type,
				'post_status'    => 'publish',
				'posts_per_page' => 200,
			]
		);
		$out = [];
		foreach ( $q as $p ) {
			$out[] = self::shape( $p );
		}
		return $out;
	}

	/**
	 * La forma en la que viaja una plantilla o un global.
	 *
	 * Hay dos clases y se distinguen por lo que llevan dentro:
	 * `node` es un bloque suelto —lo que guarda el ☆ del árbol— y
	 * `sections` es una página entera, varias secciones en orden. Una
	 * plantilla de página no cabía en `node` sin inventarse un bloque
	 * contenedor que luego nadie sabría pintar, así que viaja en su
	 * propio campo y `kind` dice cuál de las dos es.
	 */
	private static function shape( \WP_Post $p ): array {
		$secs = Document::decode( get_post_meta( $p->ID, '_meridian_sections', true ) );
		$secs = is_array( $secs ) ? array_values( array_filter( $secs, 'is_array' ) ) : [];
		$node = Document::decode( get_post_meta( $p->ID, '_meridian_node', true ) );
		// Una plantilla de pagina no guarda bloque suelto. Devolver ahi
		// un array vacio no vale: en JavaScript `[]` es verdadero y la
		// Biblioteca ofreceria insertar la nada.
		$node = ( is_array( $node ) && ! empty( $node['type'] ) ) ? $node : null;
		return [
			'id'       => $p->ID,
			'name'     => $p->post_title,
			'slug'     => $p->post_name,
			'kind'     => $secs ? 'page' : 'node',
			'node'     => $node,
			'sections' => $secs,
		];
	}

	public static function get( int $id ): ?array {
		$p = get_post( $id );
		if ( ! $p ) {
			return null;
		}
		$out         = self::shape( $p );
		$out['type'] = $p->post_type;
		return $out;
	}

	public static function save( string $type, array $payload, int $id = 0 ): array {
		// Sin bloque no se inventa uno: el saneador devolveria un parrafo
		// vacio y la plantilla de pagina acabaria con un bloque fantasma.
		$raw_node = is_array( $payload['node'] ?? null ) ? $payload['node'] : [];
		$node     = $raw_node ? \Meridian\Security\Sanitizer::node( $raw_node, 0 ) : [];
		// Una plantilla de página entera: varias secciones en orden. Se
		// sanean una a una con el mismo saneador que el resto del
		// documento, que es quien decide qué se guarda de verdad.
		$sections = [];
		foreach ( (array) ( $payload['sections'] ?? [] ) as $sec ) {
			if ( is_array( $sec ) && $sec ) {
				$sections[] = \Meridian\Security\Sanitizer::node( $sec, 0 );
			}
		}
		$title = sanitize_text_field( $payload['name'] ?? __( 'Sin nombre', 'meridian' ) );
		$args  = [
			'post_type'   => $type,
			'post_status' => 'publish',
			'post_title'  => $title,
		];
		if ( $id ) {
			$args['ID'] = $id;
			wp_update_post( $args );
		} else {
			$id = wp_insert_post( $args );
		}
		update_post_meta( (int) $id, '_meridian_node', wp_slash( wp_json_encode( $node ) ) );
		if ( $sections ) {
			update_post_meta( (int) $id, '_meridian_sections', wp_slash( wp_json_encode( $sections ) ) );
		} else {
			delete_post_meta( (int) $id, '_meridian_sections' );
		}
		return self::get( (int) $id );
	}

	public static function delete( int $id ): bool {
		return (bool) wp_delete_post( $id, true );
	}

	public static function map_by_ids( array $ids ): array {
		$ids = array_filter( array_map( 'absint', $ids ) );
		if ( ! $ids ) {
			return [];
		}
		$posts = get_posts(
			[
				'post_type'      => 'meridian_global',
				'post__in'       => $ids,
				'posts_per_page' => count( $ids ),
			]
		);
		update_meta_cache( 'post', $ids );
		$map = [];
		foreach ( $posts as $p ) {
			$map[ $p->ID ] = Document::decode( get_post_meta( $p->ID, '_meridian_node', true ) );
		}
		return $map;
	}
}
