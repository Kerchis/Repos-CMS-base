<?php
/**
 * Document helpers.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class Document {

	public static function empty( int $id = 0, string $title = '', string $slug = '' ): array {
		return [
			'version'         => 1,
			'id'              => $id,
			'type'            => 'page',
			'title'           => $title,
			'slug'            => $slug,
			'status'          => 'draft',
			'parentId'        => 0,
			'featuredImageId' => 0,
			'seo'             => [
				'title'         => '',
				'description'   => '',
				'canonical'     => '',
				'ogTitle'       => '',
				'ogDescription' => '',
				'ogImageId'     => 0,
				'robots'        => 'index,follow',
			],
			'settings'        => [
				'showHeader' => true,
				'showFooter' => true,
				'layout'     => 'default',
				'headerMenu' => '',
			],
			'sections'        => [],
		];
	}

	public static function checksum( array $doc ): string {
		unset( $doc['checksum'], $doc['previewUrl'], $doc['publicUrl'] );
		return hash( 'sha256', wp_json_encode( $doc ) );
	}

	public static function decode( $raw ): ?array {
		if ( is_array( $raw ) ) {
			return $raw;
		}
		if ( ! is_string( $raw ) || $raw === '' ) {
			return null;
		}
		$json = json_decode( $raw, true );
		if ( ! is_array( $json ) ) {
			$json = json_decode( wp_unslash( $raw ), true );
		}
		return is_array( $json ) ? $json : null;
	}
}
