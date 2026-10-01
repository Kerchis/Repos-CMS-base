<?php
/**
 * Component registry.
 *
 * @package Meridian
 */

namespace Meridian\Components;

defined( 'ABSPATH' ) || exit;

class Registry {

	/** @var array<string, array> */
	private static array $items = [];

	public static function boot(): void {
		self::$items = [];
		foreach ( Catalog::all() as $def ) {
			self::register( $def );
		}
		do_action( 'meridian_register_component' );
	}

	public static function register( array $def ): void {
		if ( empty( $def['slug'] ) ) {
			return;
		}
		$slug = sanitize_key( $def['slug'] );
		self::$items[ $slug ] = $def;
	}

	public static function get( string $slug ): ?array {
		return self::$items[ sanitize_key( $slug ) ] ?? null;
	}

	public static function all(): array {
		return array_values( self::$items );
	}

	public static function public_list(): array {
		$out = [];
		foreach ( self::$items as $def ) {
			$fields = $def['fields'] ?? [];
			$active = ! empty( $def['pluginActive'] );
			$extra  = [];
			if ( 'everest-form' === ( $def['slug'] ?? '' ) ) {
				$active = post_type_exists( 'everest_form' ) || shortcode_exists( 'everest_form' );
				$extra['everestForms'] = Catalog::everest_form_options();
			}
			$out[]  = array_merge(
				[
					'slug'         => $def['slug'],
					'name'         => $def['name'],
					'description'  => $def['description'] ?? '',
					'category'     => $def['category'] ?? 'other',
					'icon'         => $def['icon'] ?? 'block',
					'fields'       => $fields,
					'defaults'     => $def['defaults'] ?? [],
					'children'     => $def['children'] ?? false,
					'supports'     => $def['supports'] ?? [],
					'pluginActive' => $active,
				],
				$extra
			);
		}
		return $out;
	}
}
