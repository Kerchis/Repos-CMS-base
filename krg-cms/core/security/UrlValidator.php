<?php
/**
 * URL validation.
 *
 * @package Meridian
 */

namespace Meridian\Security;

defined( 'ABSPATH' ) || exit;

class UrlValidator {

	public static function sanitize( string $url ): string {
		$url = trim( $url );
		if ( $url === '' || $url === '#' ) {
			return $url;
		}
		if ( self::is_dangerous( $url ) ) {
			return '';
		}
		if ( str_starts_with( $url, '/' ) || str_starts_with( $url, '#' ) || str_starts_with( $url, 'mailto:' ) || str_starts_with( $url, 'tel:' ) ) {
			return esc_url_raw( $url );
		}
		$clean = esc_url_raw( $url, [ 'http', 'https' ] );
		return $clean ?: '';
	}

	public static function is_dangerous( string $url ): bool {
		$trim = ltrim( $url );
		return (bool) preg_match( '#^(javascript|data|vbscript):#i', $trim );
	}

	public static function is_valid( string $url ): bool {
		$url = trim( $url );
		if ( $url === '' || $url === '#' ) {
			return true;
		}
		if ( self::is_dangerous( $url ) ) {
			return false;
		}
		if ( str_starts_with( $url, '/' ) || str_starts_with( $url, '#' ) || str_starts_with( $url, 'mailto:' ) || str_starts_with( $url, 'tel:' ) ) {
			return true;
		}
		$ok = (bool) filter_var( $url, FILTER_VALIDATE_URL );
		if ( ! $ok ) {
			return false;
		}
		$scheme = strtolower( (string) wp_parse_url( $url, PHP_URL_SCHEME ) );
		return in_array( $scheme, [ 'http', 'https' ], true );
	}

	public static function maps( string $raw ): string {
		$raw = html_entity_decode( trim( wp_unslash( $raw ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		if ( $raw === '' ) {
			return '';
		}
		if ( preg_match( '/src\s*=\s*[\'"]([^\'"]+)[\'"]/i', $raw, $m ) ) {
			$raw = html_entity_decode( $m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		} elseif ( preg_match( '#https://maps\.app\.goo\.gl/[A-Za-z0-9_-]+#', $raw, $m ) ) {
			$raw = $m[0];
		} elseif ( preg_match( '#https://(?:www\.)?(?:maps\.)?google\.[a-z.]+/maps[^\\s\'"<>]*#i', $raw, $m ) ) {
			$raw = html_entity_decode( $m[0], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		}
		$raw = trim( $raw );
		if ( $raw === '' || self::is_dangerous( $raw ) || ! preg_match( '#^https://#i', $raw ) ) {
			return '';
		}
		if ( preg_match( '#^https://(maps\.app\.goo\.gl|goo\.gl)/#i', $raw ) ) {
			$expanded = self::expand_short( $raw );
			if ( $expanded ) {
				$raw = $expanded;
			}
		}
		$host = strtolower( (string) wp_parse_url( $raw, PHP_URL_HOST ) );
		$host = preg_replace( '/^www\./', '', $host );
		$ok   = (bool) preg_match( '/^(maps\.)?google(\.[a-z]{2,8}){1,3}$/', $host )
			|| in_array( $host, [ 'maps.app.goo.gl', 'goo.gl' ], true );
		if ( ! $ok ) {
			return '';
		}
		return $raw;
	}

	public static function maps_embed( string $url ): string {
		$url = self::maps( $url );
		if ( $url === '' ) {
			return '';
		}
		if ( str_contains( $url, '/maps/embed' ) || str_contains( $url, 'output=embed' ) ) {
			return $url;
		}
		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( str_contains( $host, 'goo.gl' ) ) {
			return '';
		}
		$q = wp_parse_url( $url, PHP_URL_QUERY );
		parse_str( (string) $q, $params );
		$place = $params['q'] ?? $params['query'] ?? '';
		if ( $place === '' && preg_match( '#/maps/place/([^/]+)#', $url, $m ) ) {
			$place = rawurldecode( $m[1] );
		}
		if ( $place === '' && preg_match( '#/@(-?\d+\.\d+),(-?\d+\.\d+)#', $url, $m ) ) {
			$place = $m[1] . ',' . $m[2];
		}
		if ( $place === '' ) {
			$place = $url;
		}
		return 'https://maps.google.com/maps?output=embed&q=' . rawurlencode( $place );
	}

	private static function expand_short( string $url ): string {
		$current = $url;
		for ( $i = 0; $i < 6; $i++ ) {
			$res = wp_remote_get(
				$current,
				[
					'timeout'     => 8,
					'redirection' => 0,
					'sslverify'   => false,
					'headers'     => [ 'User-Agent' => 'Mozilla/5.0' ],
				]
			);
			if ( is_wp_error( $res ) ) {
				break;
			}
			$code = (int) wp_remote_retrieve_response_code( $res );
			$loc  = wp_remote_retrieve_header( $res, 'location' );
			if ( $code >= 300 && $code < 400 && is_string( $loc ) && $loc !== '' ) {
				if ( str_starts_with( $loc, '/' ) ) {
					$loc = 'https://maps.app.goo.gl' . $loc;
				}
				$current = $loc;
				if ( str_contains( $current, 'google.' ) && str_contains( $current, '/maps' ) ) {
					return $current;
				}
				continue;
			}
			break;
		}
		return str_contains( $current, 'google.' ) ? $current : '';
	}
}
