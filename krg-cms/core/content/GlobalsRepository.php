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
			$out[] = [
				'id'   => $p->ID,
				'name' => $p->post_title,
				'slug' => $p->post_name,
				'node' => Document::decode( get_post_meta( $p->ID, '_meridian_node', true ) ),
			];
		}
		return $out;
	}

	public static function get( int $id ): ?array {
		$p = get_post( $id );
		if ( ! $p ) {
			return null;
		}
		return [
			'id'   => $p->ID,
			'name' => $p->post_title,
			'slug' => $p->post_name,
			'type' => $p->post_type,
			'node' => Document::decode( get_post_meta( $p->ID, '_meridian_node', true ) ),
		];
	}

	public static function save( string $type, array $payload, int $id = 0 ): array {
		$node = \Meridian\Security\Sanitizer::node( $payload['node'] ?? [], 0 );
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
