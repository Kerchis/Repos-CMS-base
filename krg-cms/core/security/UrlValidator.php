<?php
/**
 * URL validation.
 *
 * @package Meridian
 */

namespace Meridian\Security;

defined( 'ABSPATH' ) || exit;

class UrlValidator {

	/** Acortadores que la expansión de mapas tiene permiso para pedir. */
	private const CORTOS = [ 'maps.app.goo.gl', 'goo.gl' ];

	/** Saltos de redirección que se siguen antes de rendirse. */
	private const SALTOS = 6;

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
		if ( ! self::host_de_mapas( $raw ) ) {
			return '';
		}
		return $raw;
	}

	/**
	 * ¿El anfitrión de esta URL es de los que admitimos para mapas?
	 *
	 * Google en cualquier dominio nacional, o uno de los dos acortadores.
	 * Se mira el anfitrión de verdad, no si la cadena «contiene google.»:
	 * `https://ejemplo.com/?x=google./maps` no es Google.
	 */
	private static function host_de_mapas( string $url ): bool {
		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$host = (string) preg_replace( '/^www\./', '', $host );
		if ( '' === $host ) {
			return false;
		}
		return (bool) preg_match( '/^(maps\.)?google(\.[a-z]{2,8}){1,3}$/', $host )
			|| in_array( $host, self::CORTOS, true );
	}

	/** Un mapa de Google de verdad: anfitrión de Google y ruta de mapas. */
	private static function es_mapa( string $url ): bool {
		if ( ! self::host_de_mapas( $url ) ) {
			return false;
		}
		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( in_array( preg_replace( '/^www\./', '', $host ), self::CORTOS, true ) ) {
			return false;
		}
		$ruta = (string) wp_parse_url( $url, PHP_URL_PATH );
		return str_contains( $ruta, '/maps' );
	}

	/**
	 * El destino de una redirección, resuelto contra la URL de partida.
	 *
	 * Devuelve cadena vacía para cualquier cosa que no acabe siendo una
	 * URL `https` absoluta: ni bajadas a `http`, ni esquemas raros.
	 */
	private static function resolver_salto( string $base, string $loc ): string {
		$loc = trim( $loc );
		if ( '' === $loc || self::is_dangerous( $loc ) ) {
			return '';
		}
		if ( str_starts_with( $loc, '//' ) ) {
			$loc = 'https:' . $loc;
		} elseif ( str_starts_with( $loc, '/' ) ) {
			$host = (string) wp_parse_url( $base, PHP_URL_HOST );
			if ( '' === $host ) {
				return '';
			}
			$loc = 'https://' . $host . $loc;
		}
		return preg_match( '#^https://#i', $loc ) ? $loc : '';
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

	/**
	 * Sigue un enlace corto de Google hasta el mapa que hay detrás.
	 *
	 * Esta función hace que el servidor pida una URL, así que es el sitio
	 * del tema donde cabría una SSRF. Tres cierres:
	 *
	 * 1. Cada salto se comprueba contra la lista blanca ANTES de pedirlo.
	 *    Que la primera URL sea de `goo.gl` no basta: si la redirección
	 *    apunta a `http://127.0.0.1:8080/` o a los metadatos de la nube
	 *    en `169.254.169.254`, aquí se corta.
	 * 2. `sslverify` va en `true`. Sin verificar el certificado, quien
	 *    esté en medio de la red se hace pasar por Google y dicta la
	 *    redirección.
	 * 3. `reject_unsafe_urls` deja que WordPress descarte además las
	 *    direcciones privadas y los puertos que no sean los de siempre.
	 */
	private static function expand_short( string $url ): string {
		$current = $url;
		for ( $i = 0; $i < self::SALTOS; $i++ ) {
			if ( ! preg_match( '#^https://#i', $current ) || ! self::host_de_mapas( $current ) ) {
				return '';
			}
			$res = wp_remote_get(
				$current,
				[
					'timeout'            => 8,
					'redirection'        => 0,
					'sslverify'          => true,
					'reject_unsafe_urls' => true,
					'headers'            => [ 'User-Agent' => 'Mozilla/5.0' ],
				]
			);
			if ( is_wp_error( $res ) ) {
				break;
			}
			$code = (int) wp_remote_retrieve_response_code( $res );
			$loc  = wp_remote_retrieve_header( $res, 'location' );
			if ( $code >= 300 && $code < 400 && is_string( $loc ) && '' !== $loc ) {
				$salto = self::resolver_salto( $current, $loc );
				if ( '' === $salto || ! self::host_de_mapas( $salto ) ) {
					// El salto se sale de la lista: no se pide, y no se
					// devuelve nada. La URL corta original se queda tal
					// cual, que es lo que pasaba ya cuando fallaba.
					return '';
				}
				$current = $salto;
				if ( self::es_mapa( $current ) ) {
					return $current;
				}
				continue;
			}
			break;
		}
		return self::es_mapa( $current ) ? $current : '';
	}
}
