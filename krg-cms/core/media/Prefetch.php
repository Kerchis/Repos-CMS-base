<?php
/**
 * Batch-load attachments used by a document (avoids N+1).
 *
 * @package Meridian
 */

namespace Meridian\Media;

defined( 'ABSPATH' ) || exit;

class Prefetch {

	public static function collect_from_document( array $doc ): array {
		$ids = [];
		if ( ! empty( $doc['featuredImageId'] ) ) {
			$ids[] = (int) $doc['featuredImageId'];
		}
		if ( ! empty( $doc['seo']['ogImageId'] ) ) {
			$ids[] = (int) $doc['seo']['ogImageId'];
		}
		self::walk( $doc['sections'] ?? [], $ids );
		return array_values( array_unique( array_filter( $ids ) ) );
	}

	public static function walk( array $nodes, array &$ids ): void {
		foreach ( $nodes as $n ) {
			$p = is_array( $n['props'] ?? null ) ? $n['props'] : [];
			foreach ( [ 'imageId', 'logoId', 'faviconId', 'ogImageId' ] as $k ) {
				if ( ! empty( $p[ $k ] ) ) {
					$ids[] = (int) $p[ $k ];
				}
			}
			if ( ! empty( $p['ids'] ) && is_string( $p['ids'] ) ) {
				foreach ( explode( ',', $p['ids'] ) as $piece ) {
					$ids[] = absint( $piece );
				}
			}
			foreach ( $p['items'] ?? [] as $item ) {
				if ( is_array( $item ) && ! empty( $item['imageId'] ) ) {
					$ids[] = (int) $item['imageId'];
				}
			}
			if ( ! empty( $n['children'] ) && is_array( $n['children'] ) ) {
				self::walk( $n['children'], $ids );
			}
		}
	}

	public static function types( array $nodes ): array {
		$found = [];
		$walk  = static function ( array $list ) use ( &$walk, &$found ) {
			foreach ( $list as $n ) {
				$t = $n['type'] ?? '';
				if ( $t ) {
					$found[ $t ] = true;
				}
				if ( ! empty( $n['children'] ) ) {
					$walk( $n['children'] );
				}
			}
		};
		$walk( $nodes );
		return $found;
	}

	public static function prime( array $ids ): void {
		$ids = array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
		if ( ! $ids ) {
			return;
		}
		_prime_post_caches( $ids, true, true );
		update_meta_cache( 'post', $ids );
	}
}
