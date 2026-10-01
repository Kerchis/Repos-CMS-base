<?php
/**
 * Compile tokens JSON → CSS custom properties.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class TokenCompiler {

	public static function css(): string {
		$cached = get_transient( 'meridian_tokens_css' );
		if ( is_string( $cached ) && $cached !== '' ) {
			return $cached;
		}
		$css = self::compile( TokenRepository::get() );
		set_transient( 'meridian_tokens_css', $css, DAY_IN_SECONDS );
		return $css;
	}

	public static function compile( array $data ): string {
		$tokens = $data['tokens'] ?? [];
		$lines  = [ ':root {' ];

		foreach ( $tokens['color'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --color-' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['font'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			$key = sanitize_html_class( $name );
			if ( $val ) {
				$lines[] = '  --font-' . $key . ': ' . $val . ';';
			}
			if ( is_array( $item ) ) {
				$weight = preg_replace( '/[^0-9]/', '', (string) ( $item['weight'] ?? '' ) );
				$style  = sanitize_key( (string) ( $item['style'] ?? '' ) );
				if ( $weight ) {
					$lines[] = '  --font-' . $key . '-weight: ' . $weight . ';';
				}
				if ( in_array( $style, [ 'normal', 'italic', 'oblique' ], true ) ) {
					$lines[] = '  --font-' . $key . '-style: ' . $style . ';';
				}
			}
		}
		foreach ( $tokens['spacing'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --spacing-' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['radius'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --radius-' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['shadow'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --shadow-' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['layout'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['breakpoint'] ?? [] as $name => $item ) {
			$val = self::scalar( $item );
			if ( $val ) {
				$lines[] = '  --bp-' . sanitize_html_class( $name ) . ': ' . $val . ';';
			}
		}
		foreach ( $tokens['typography'] ?? [] as $role => $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$role = sanitize_html_class( $role );
			if ( ! empty( $item['fontSize'] ) ) {
				$lines[] = '  --text-' . $role . '-size: ' . self::safe_css( $item['fontSize'] ) . ';';
			}
			if ( ! empty( $item['lineHeight'] ) ) {
				$lines[] = '  --text-' . $role . '-leading: ' . self::safe_css( (string) $item['lineHeight'] ) . ';';
			}
			if ( ! empty( $item['letterSpacing'] ) ) {
				$lines[] = '  --text-' . $role . '-tracking: ' . self::safe_css( $item['letterSpacing'] ) . ';';
			}
			if ( ! empty( $item['fontWeight'] ) ) {
				$lines[] = '  --text-' . $role . '-weight: ' . self::safe_css( (string) $item['fontWeight'] ) . ';';
			}
			if ( ! empty( $item['fontFamily'] ) ) {
				$fam     = $item['fontFamily'];
				$fam_css = str_starts_with( $fam, 'var(' ) ? $fam : 'var(--font-' . sanitize_html_class( $fam ) . ')';
				$lines[] = '  --text-' . $role . '-font: ' . $fam_css . ';';
			}
			if ( ! empty( $item['textTransform'] ) ) {
				$lines[] = '  --text-' . $role . '-transform: ' . self::safe_css( $item['textTransform'] ) . ';';
			}
		}

		$lines[] = '  --button-bg: var(--color-primary);';
		$lines[] = '  --button-fg: var(--color-on-primary, #fff);';
		$lines[] = '  --button-bg-hover: var(--color-secondary);';
		$lines[] = '}';

		return implode( "\n", $lines );
	}

	private static function scalar( $item ): string {
		if ( is_string( $item ) ) {
			return self::safe_css( $item );
		}
		if ( is_array( $item ) && isset( $item['value'] ) ) {
			return self::safe_css( (string) $item['value'] );
		}
		return '';
	}

	public static function safe_css( string $value ): string {
		$value = trim( $value );
		$value = str_replace( [ "\n", "\r", '{', '}', '<', '>' ], '', $value );
		return $value;
	}

	public static function token_var( string $path ): string {
		$path = str_replace( '_', '-', $path );
		if ( str_starts_with( $path, 'color.' ) ) {
			return 'var(--color-' . sanitize_html_class( substr( $path, 6 ) ) . ')';
		}
		if ( str_starts_with( $path, 'font.' ) ) {
			return 'var(--font-' . sanitize_html_class( substr( $path, 5 ) ) . ')';
		}
		if ( str_starts_with( $path, 'spacing.' ) ) {
			return 'var(--spacing-' . sanitize_html_class( substr( $path, 8 ) ) . ')';
		}
		if ( str_starts_with( $path, 'radius.' ) ) {
			return 'var(--radius-' . sanitize_html_class( substr( $path, 7 ) ) . ')';
		}
		if ( str_starts_with( $path, 'shadow.' ) ) {
			return 'var(--shadow-' . sanitize_html_class( substr( $path, 7 ) ) . ')';
		}
		return 'var(--' . sanitize_html_class( str_replace( '.', '-', $path ) ) . ')';
	}
}
