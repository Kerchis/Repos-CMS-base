<?php
/**
 * Presets creados desde el CMS.
 *
 * Los presets de archivo (presets/*.json) vienen con el tema y no se tocan.
 * Los que crea el usuario viven en una opción, así que una actualización del
 * tema nunca los pisa ni los borra.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class PresetStore {

	/** Tope defensivo: evita que la opción crezca sin control. */
	private const MAX = 40;

	/**
	 * Todos los presets de usuario, indexados por slug.
	 */
	public static function all(): array {
		$raw = get_option( MERIDIAN_OPTION_PRESETS, [] );
		return is_array( $raw ) ? $raw : [];
	}

	/**
	 * Un preset de usuario, o null si no existe.
	 */
	public static function get( string $slug ): ?array {
		$slug = sanitize_key( $slug );
		$all  = self::all();
		return isset( $all[ $slug ] ) && is_array( $all[ $slug ] ) ? $all[ $slug ] : null;
	}

	/**
	 * ¿Es un slug de preset de archivo? Esos no se pueden sobrescribir.
	 */
	public static function is_builtin( string $slug ): bool {
		$slug = sanitize_key( $slug );
		if ( '' === $slug ) {
			return false;
		}
		$path = trailingslashit( MERIDIAN_PATH ) . 'presets/' . $slug . '.json';
		return is_readable( $path );
	}

	/**
	 * Slug libre a partir de un nombre.
	 */
	public static function unique_slug( string $name, string $keep = '' ): string {
		$base = sanitize_title( $name );
		if ( '' === $base ) {
			$base = 'preset';
		}
		$base = substr( $base, 0, 48 );
		$all  = self::all();
		$slug = $base;
		$i    = 2;
		while ( ( isset( $all[ $slug ] ) && $slug !== $keep ) || ( self::is_builtin( $slug ) && $slug !== $keep ) ) {
			$slug = $base . '-' . $i;
			++$i;
			if ( $i > 200 ) {
				break;
			}
		}
		return $slug;
	}

	/**
	 * Crea o actualiza un preset de usuario.
	 *
	 * @param string $name   Nombre visible.
	 * @param array  $tokens Árbol de tokens completo.
	 * @param string $slug   Slug a actualizar; vacío para crear uno nuevo.
	 * @return array|\WP_Error El preset guardado.
	 */
	public static function save( string $name, array $tokens, string $slug = '' ) {
		$name = sanitize_text_field( $name );
		if ( '' === trim( $name ) ) {
			return new \WP_Error( 'krg_preset_name', __( 'El preset necesita un nombre.', 'meridian' ), [ 'status' => 400 ] );
		}
		if ( ! $tokens ) {
			return new \WP_Error( 'krg_preset_tokens', __( 'El preset no tiene tokens que guardar.', 'meridian' ), [ 'status' => 400 ] );
		}

		$slug = sanitize_key( $slug );
		if ( $slug && self::is_builtin( $slug ) ) {
			return new \WP_Error(
				'krg_preset_builtin',
				__( 'Los presets que vienen con el tema no se pueden modificar. Duplícalo con otro nombre.', 'meridian' ),
				[ 'status' => 409 ]
			);
		}

		$all = self::all();
		if ( ! $slug ) {
			if ( count( $all ) >= self::MAX ) {
				return new \WP_Error(
					'krg_preset_limit',
					sprintf(
						/* translators: %d número máximo de presets */
						__( 'Has llegado al máximo de %d presets propios. Borra alguno para crear otro.', 'meridian' ),
						self::MAX
					),
					[ 'status' => 409 ]
				);
			}
			$slug = self::unique_slug( $name );
		}

		$entry = [
			'slug'   => $slug,
			'name'   => $name,
			'tokens' => \Meridian\Design\TokenRepository::normalize_payload( [ 'tokens' => $tokens ] )['tokens'] ?? [],
		];
		if ( ! $entry['tokens'] ) {
			return new \WP_Error( 'krg_preset_tokens', __( 'El preset no tiene tokens válidos.', 'meridian' ), [ 'status' => 400 ] );
		}

		$all[ $slug ] = $entry;
		update_option( MERIDIAN_OPTION_PRESETS, $all, false );
		return $entry;
	}

	/**
	 * Borra un preset de usuario.
	 */
	public static function delete( string $slug ) {
		$slug = sanitize_key( $slug );
		if ( self::is_builtin( $slug ) ) {
			return new \WP_Error(
				'krg_preset_builtin',
				__( 'Los presets que vienen con el tema no se pueden borrar.', 'meridian' ),
				[ 'status' => 409 ]
			);
		}
		$all = self::all();
		if ( ! isset( $all[ $slug ] ) ) {
			return new \WP_Error( 'krg_preset_missing', __( 'Ese preset ya no existe.', 'meridian' ), [ 'status' => 404 ] );
		}
		unset( $all[ $slug ] );
		update_option( MERIDIAN_OPTION_PRESETS, $all, false );

		// Si estaba activo, los tokens siguen tal cual: solo deja de haber
		// un preset marcado, para no cambiarle el sitio al usuario de golpe.
		$tokens = get_option( MERIDIAN_OPTION_TOKENS, [] );
		if ( is_array( $tokens ) && ( $tokens['activePreset'] ?? '' ) === $slug ) {
			$tokens['activePreset'] = '';
			update_option( MERIDIAN_OPTION_TOKENS, $tokens, false );
		}
		return true;
	}
}
