<?php
/**
 * Token persistence.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class TokenRepository {

	public static function ensure_defaults(): void {
		$current = get_option( MERIDIAN_OPTION_TOKENS );
		if ( is_array( $current ) && ! empty( $current['tokens'] ) ) {
			return;
		}
		$slug   = (string) apply_filters( 'meridian_default_preset', MERIDIAN_DEFAULT_PRESET );
		$preset = self::load_preset_file( $slug );
		if ( ! $preset ) {
			$slug   = 'marca';
			$preset = self::load_preset_file( $slug );
		}
		if ( $preset ) {
			$preset['activePreset'] = $slug;
			$preset['customColors'] = [];
			$preset['version']       = 1;
			update_option( MERIDIAN_OPTION_TOKENS, $preset, false );
		}
	}

	public static function get(): array {
		self::ensure_defaults();
		$data = get_option( MERIDIAN_OPTION_TOKENS, [] );
		return is_array( $data ) ? $data : [];
	}

	public static function normalize_payload( array $data ): array {
		if ( isset( $data['data'] ) && is_array( $data['data'] ) && ( isset( $data['data']['tokens'] ) || ! isset( $data['tokens'] ) ) ) {
			$data = $data['data'];
		}
		if ( isset( $data['tokens']['tokens'] ) && is_array( $data['tokens']['tokens'] ) ) {
			$data['tokens'] = $data['tokens']['tokens'];
		}
		return $data;
	}

	public static function save( array $data, bool $replace = false ) {
		$data = self::normalize_payload( $data );
		if ( empty( $data['tokens'] ) || ! is_array( $data['tokens'] ) ) {
			return new \WP_Error(
				'krg_tokens',
				__( 'No se recibieron tokens para guardar. Vuelve a pulsar Guardar.', 'meridian' ),
				[ 'status' => 400 ]
			);
		}
		$current = get_option( MERIDIAN_OPTION_TOKENS, [] );
		if ( ! is_array( $current ) ) {
			$current = [];
		}
		$merged           = $current;
		$merged['tokens'] = is_array( $current['tokens'] ?? null ) ? $current['tokens'] : [];
		foreach ( [ 'color', 'font', 'typography', 'spacing', 'radius', 'shadow', 'layout', 'breakpoint' ] as $group ) {
			if ( isset( $data['tokens'][ $group ] ) && is_array( $data['tokens'][ $group ] ) ) {
				$merged['tokens'][ $group ] = $data['tokens'][ $group ];
			}
		}
		if ( array_key_exists( 'activePreset', $data ) ) {
			$merged['activePreset'] = sanitize_key( (string) $data['activePreset'] );
		}
		if ( ! empty( $data['slug'] ) ) {
			$merged['slug'] = sanitize_key( (string) $data['slug'] );
		}
		if ( ! empty( $data['name'] ) ) {
			$merged['name'] = sanitize_text_field( (string) $data['name'] );
		}
		$merged['customColors'] = is_array( $data['customColors'] ?? null ) ? $data['customColors'] : ( $current['customColors'] ?? [] );
		$merged['version']      = 1;

		delete_option( MERIDIAN_OPTION_TOKENS );
		add_option( MERIDIAN_OPTION_TOKENS, $merged, '', false );
		update_option( MERIDIAN_OPTION_TOKENS, $merged, false );
		wp_cache_delete( MERIDIAN_OPTION_TOKENS, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		delete_transient( 'meridian_tokens_css' );
		\Meridian\Cache\DocumentCache::flush_chrome();
		return $merged;
	}

	public static function patch_colors( array $colors ): array {
		$data = self::get();
		$data['tokens'] = $data['tokens'] ?? [];
		$data['tokens']['color'] = $data['tokens']['color'] ?? [];
		foreach ( $colors as $key => $value ) {
			$key = sanitize_key( (string) $key );
			$hex = sanitize_hex_color( (string) $value );
			if ( ! $key || ! $hex ) {
				continue;
			}
			$current = $data['tokens']['color'][ $key ] ?? [];
			if ( ! is_array( $current ) ) {
				$current = [ 'value' => $current ];
			}
			$current['value'] = $hex;
			$current['type']  = 'color';
			$data['tokens']['color'][ $key ] = $current;
		}
		return self::save( $data );
	}

	public static function activate_preset( string $slug ) {
		$slug   = sanitize_key( $slug );
		$preset = self::load_preset_file( $slug );
		if ( ! $preset || empty( $preset['tokens'] ) ) {
			return new \WP_Error(
				'krg_preset',
				sprintf(
					/* translators: %s preset slug */
					__( 'No se pudo cargar el preset «%s».', 'meridian' ),
					$slug
				),
				[ 'status' => 404 ]
			);
		}
		$preset['activePreset'] = $slug;
		$preset['customColors'] = [];
		$preset['version']      = 1;
		return self::save( $preset, true );
	}

	public static function load_preset_file( string $slug ): ?array {
		$slug = sanitize_key( $slug );
		if ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
			return null;
		}
		$path = trailingslashit( MERIDIAN_PATH ) . 'presets/' . $slug . '.json';
		if ( ! is_readable( $path ) ) {
			return null;
		}
		$json = json_decode( (string) file_get_contents( $path ), true );
		return is_array( $json ) ? $json : null;
	}

	public static function list_presets(): array {
		$out = [];
		foreach ( glob( trailingslashit( MERIDIAN_PATH ) . 'presets/*.json' ) ?: [] as $file ) {
			$json = json_decode( (string) file_get_contents( $file ), true );
			if ( ! is_array( $json ) ) {
				continue;
			}
			$color    = is_array( $json['tokens']['color'] ?? null ) ? $json['tokens']['color'] : [];
			$swatches = [];
			foreach ( [ 'primary', 'secondary', 'tertiary', 'background', 'text' ] as $key ) {
				$hex = $color[ $key ]['value'] ?? '';
				if ( is_string( $hex ) && $hex !== '' ) {
					$swatches[] = $hex;
				}
			}
			$out[] = [
				'slug'     => $json['slug'] ?? basename( $file, '.json' ),
				'name'     => $json['name'] ?? basename( $file, '.json' ),
				'swatches' => $swatches,
				'tokens'   => is_array( $json['tokens'] ?? null ) ? $json['tokens'] : [],
			];
		}
		return $out;
	}
}
