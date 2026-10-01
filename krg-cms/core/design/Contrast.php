<?php
/**
 * Resolución de contraste para la cabecera adaptativa.
 *
 * Decide si sobre un fondo dado la cabecera debe pintar texto claro u oscuro.
 * Resuelve tokens contra el preset activo, así que cambiar de paleta recalcula
 * el contraste solo, sin tocar contenido.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class Contrast {

	/** Temas de bloque del sistema visual → piel de cabecera. */
	private const THEME_SKIN = [
		'light'   => 'dark',
		'cream'   => 'dark',
		'surface' => 'dark',
		'forest'  => 'light',
		'dark'    => 'light',
	];

	/**
	 * Piel de cabecera para un tema de bloque (`is-theme-*`).
	 *
	 * @return string `light` (texto claro) o `dark` (texto oscuro).
	 */
	public static function for_theme( string $theme ): string {
		return self::THEME_SKIN[ $theme ] ?? 'dark';
	}

	/**
	 * Piel de cabecera para un campo de color del esquema.
	 *
	 * @param mixed $color Valor del campo `color` (array con mode/token/value).
	 * @return string `light`, `dark` o '' si no se puede determinar.
	 */
	public static function for_color( $color ): string {
		$hex = self::resolve_hex( $color );
		if ( '' === $hex ) {
			return '';
		}
		return self::is_dark( $hex ) ? 'light' : 'dark';
	}

	/**
	 * Convierte un campo de color en un hex concreto, resolviendo tokens
	 * contra el preset activo.
	 *
	 * @param mixed $color Valor del campo `color`.
	 */
	public static function resolve_hex( $color ): string {
		if ( is_string( $color ) ) {
			$hex = sanitize_hex_color( $color );
			return $hex ? $hex : '';
		}
		if ( ! is_array( $color ) ) {
			return '';
		}
		if ( ( $color['mode'] ?? '' ) === 'token' && ! empty( $color['token'] ) ) {
			return self::token_hex( (string) $color['token'] );
		}
		if ( ! empty( $color['value'] ) ) {
			$hex = sanitize_hex_color( (string) $color['value'] );
			return $hex ? $hex : '';
		}
		return '';
	}

	/** Busca el valor real de un token de color en el preset activo. */
	public static function token_hex( string $path ): string {
		$path = str_replace( '_', '-', $path );
		if ( ! str_starts_with( $path, 'color.' ) ) {
			return '';
		}
		$name = substr( $path, 6 );

		static $colors = null;
		if ( null === $colors ) {
			$data   = TokenRepository::get();
			$colors = is_array( $data['tokens']['color'] ?? null ) ? $data['tokens']['color'] : [];
		}
		$item = $colors[ $name ] ?? null;
		$raw  = is_array( $item ) ? (string) ( $item['value'] ?? '' ) : (string) $item;
		$hex  = sanitize_hex_color( trim( $raw ) );
		return $hex ? $hex : '';
	}

	/**
	 * Luminancia relativa (WCAG) para decidir el contraste.
	 *
	 * @param string $hex Color en formato #rgb o #rrggbb.
	 */
	public static function is_dark( string $hex ): bool {
		$hex = ltrim( $hex, '#' );
		if ( 3 === strlen( $hex ) ) {
			$hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
		}
		if ( 6 !== strlen( $hex ) || ! ctype_xdigit( $hex ) ) {
			return false;
		}
		$channels = [];
		foreach ( [ 0, 2, 4 ] as $offset ) {
			$c = hexdec( substr( $hex, $offset, 2 ) ) / 255;
			// Linealización sRGB antes de ponderar.
			$channels[] = $c <= 0.03928 ? $c / 12.92 : pow( ( $c + 0.055 ) / 1.055, 2.4 );
		}
		$luminance = 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
		return $luminance < 0.42;
	}
}
