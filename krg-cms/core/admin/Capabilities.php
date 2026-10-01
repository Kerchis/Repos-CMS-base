<?php
/**
 * Capabilities.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Capabilities {

	public const VERSION = 3;

	public const ALL = [
		'meridian_manage',
		'meridian_edit_pages',
		'meridian_publish_pages',
		'meridian_manage_templates',
	];

	public static function register(): void {
		// Caps live on WP roles.
	}

	public static function maybe_install_caps(): void {
		if ( (int) get_option( 'meridian_caps_version', 0 ) === self::VERSION && get_option( MERIDIAN_OPTION_ROLE_CAPS ) ) {
			return;
		}
		self::install();
	}

	public static function defaults(): array {
		return [
			'administrator' => self::ALL,
			'editor'        => [ 'meridian_edit_pages', 'meridian_publish_pages', 'meridian_manage_templates' ],
			'author'        => [],
			'contributor'   => [],
			'subscriber'    => [],
		];
	}

	public static function get_matrix(): array {
		$saved = get_option( MERIDIAN_OPTION_ROLE_CAPS, null );
		if ( is_array( $saved ) && $saved ) {
			return self::normalize( $saved );
		}
		return self::defaults();
	}

	public static function cap_labels(): array {
		return [
			'meridian_manage'           => __( 'Tokens, header, SEO, usuarios', 'meridian' ),
			'meridian_edit_pages'       => __( 'Editar páginas (constructor)', 'meridian' ),
			'meridian_publish_pages'    => __( 'Publicar páginas', 'meridian' ),
			'meridian_manage_templates' => __( 'Plantillas y globales', 'meridian' ),
		];
	}

	public static function payload(): array {
		$matrix = self::get_matrix();
		$roles  = [];
		foreach ( Users::ROLES as $slug ) {
			$caps = $matrix[ $slug ] ?? [];
			$roles[] = [
				'slug'  => $slug,
				'label' => Users::role_label( $slug ),
				'caps'  => array_values( $caps ),
			];
		}
		return [
			'roles' => $roles,
			'caps'  => array_map(
				static fn( $k, $label ) => [ 'key' => $k, 'label' => $label ],
				array_keys( self::cap_labels() ),
				array_values( self::cap_labels() )
			),
		];
	}

	public static function save_matrix( array $incoming ) {
		if ( ! Users::can() ) {
			return new \WP_Error( 'meridian_users', __( 'No tienes permiso para cambiar roles.', 'meridian' ), [ 'status' => 403 ] );
		}
		$matrix = [];
		$rows   = $incoming['roles'] ?? $incoming;
		if ( ! is_array( $rows ) ) {
			return new \WP_Error( 'meridian_users', __( 'Datos de roles no válidos.', 'meridian' ), [ 'status' => 400 ] );
		}
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$slug = sanitize_key( $row['slug'] ?? '' );
			if ( ! in_array( $slug, Users::ROLES, true ) ) {
				continue;
			}
			$caps = [];
			foreach ( (array) ( $row['caps'] ?? [] ) as $cap ) {
				$cap = sanitize_key( (string) $cap );
				if ( in_array( $cap, self::ALL, true ) ) {
					$caps[] = $cap;
				}
			}
			$matrix[ $slug ] = array_values( array_unique( $caps ) );
		}
		$matrix = self::normalize( $matrix );
		if ( ! in_array( 'meridian_manage', $matrix['administrator'], true ) ) {
			$matrix['administrator'][] = 'meridian_manage';
		}
		update_option( MERIDIAN_OPTION_ROLE_CAPS, $matrix, false );
		self::apply( $matrix );
		return self::payload();
	}

	public static function install(): void {
		$matrix = self::get_matrix();
		if ( ! get_option( MERIDIAN_OPTION_ROLE_CAPS ) ) {
			update_option( MERIDIAN_OPTION_ROLE_CAPS, $matrix, false );
		}
		self::apply( $matrix );
		update_option( 'meridian_caps_installed', 1 );
		update_option( 'meridian_caps_version', self::VERSION );
	}

	public static function apply( array $matrix ): void {
		$matrix = self::normalize( $matrix );
		foreach ( $matrix as $role_name => $caps ) {
			$role = get_role( $role_name );
			if ( ! $role ) {
				continue;
			}
			foreach ( self::ALL as $cap ) {
				if ( in_array( $cap, $caps, true ) ) {
					$role->add_cap( $cap );
				} else {
					$role->remove_cap( $cap );
				}
			}
		}
	}

	private static function normalize( array $matrix ): array {
		$out = self::defaults();
		foreach ( $out as $slug => $_ ) {
			if ( isset( $matrix[ $slug ] ) && is_array( $matrix[ $slug ] ) ) {
				$caps = [];
				foreach ( $matrix[ $slug ] as $cap ) {
					$cap = sanitize_key( (string) $cap );
					if ( in_array( $cap, self::ALL, true ) ) {
						$caps[] = $cap;
					}
				}
				$out[ $slug ] = array_values( array_unique( $caps ) );
			}
		}
		if ( ! in_array( 'meridian_manage', $out['administrator'], true ) ) {
			$out['administrator'][] = 'meridian_manage';
		}
		return $out;
	}
}
