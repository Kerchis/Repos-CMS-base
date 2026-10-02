<?php
/**
 * Minimo de WordPress para los bancos de pruebas.
 *
 * Solo define lo que tocan el catalogo, el registro y el saneador. No es un
 * WordPress: lo que depende de la base de datos devuelve vacio a proposito.
 * Todo va protegido con function_exists para poder convivir con otros bancos.
 *
 * @package Meridian
 */

if ( ! function_exists( '__' ) ) {
	function __( $t, $d = '' ) { return $t; }
}
if ( ! function_exists( '_x' ) ) {
	function _x( $t, $c = '', $d = '' ) { return $t; }
}
if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $t, $d = '' ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_attr__' ) ) {
	function esc_attr__( $t, $d = '' ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_url' ) ) {
	function esc_url( $u ) { return htmlspecialchars( (string) $u, ENT_QUOTES, 'UTF-8' ); }
}
if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $u ) { return (string) $u; }
}
if ( ! function_exists( 'absint' ) ) {
	function absint( $n ) { return abs( (int) $n ); }
}
if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $k ) { return strtolower( preg_replace( '/[^a-z0-9_\-]/i', '', (string) $k ) ); }
}
if ( ! function_exists( 'sanitize_html_class' ) ) {
	function sanitize_html_class( $c, $fallback = '' ) {
		$c = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $c );
		return '' === $c ? $fallback : $c;
	}
}
if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'sanitize_textarea_field' ) ) {
	function sanitize_textarea_field( $t ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $t ) { return filter_var( (string) $t, FILTER_SANITIZE_EMAIL ); }
}
if ( ! function_exists( 'is_email' ) ) {
	function is_email( $t ) { return (bool) filter_var( (string) $t, FILTER_VALIDATE_EMAIL ); }
}
if ( ! function_exists( 'sanitize_title' ) ) {
	function sanitize_title( $t ) {
		$t = strtolower( trim( strip_tags( (string) $t ) ) );
		$t = strtr( $t, [ 'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u' ] );
		$t = preg_replace( '/[^a-z0-9]+/', '-', $t );
		return trim( (string) $t, '-' );
	}
}
if ( ! function_exists( 'sanitize_hex_color' ) ) {
	function sanitize_hex_color( $c ) {
		$c = trim( (string) $c );
		return preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $c ) ? $c : null;
	}
}
if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $t, $br = false ) { return trim( strip_tags( (string) $t ) ); }
}
if ( ! function_exists( 'wp_kses_post' ) ) {
	function wp_kses_post( $t ) { return (string) $t; }
}
if ( ! function_exists( 'wp_kses' ) ) {
	function wp_kses( $t, $allowed = [] ) { return (string) $t; }
}
if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $a, $b = [] ) { return array_merge( (array) $b, (array) $a ); }
}
if ( ! function_exists( 'wp_unslash' ) ) {
	function wp_unslash( $v ) { return $v; }
}
if ( ! function_exists( 'wp_unique_id' ) ) {
	function wp_unique_id( $p = '' ) { static $i = 0; return $p . ( ++$i ); }
}
if ( ! function_exists( 'wp_json_encode' ) ) {
	function wp_json_encode( $d, $f = 0 ) { return json_encode( $d, $f ); }
}
if ( ! function_exists( 'wp_rand' ) ) {
	function wp_rand( $min = 0, $max = 0 ) { return $min; }
}
if ( ! function_exists( 'apply_filters' ) ) {
	function apply_filters( $tag, $value, ...$rest ) { return $value; }
}
if ( ! function_exists( 'do_action' ) ) {
	function do_action( ...$a ) {}
}
if ( ! function_exists( 'add_action' ) ) {
	function add_action( ...$a ) {}
}
if ( ! function_exists( 'add_filter' ) ) {
	function add_filter( ...$a ) {}
}
if ( ! function_exists( 'get_option' ) ) {
	function get_option( $k, $d = false ) { return $d; }
}
if ( ! function_exists( 'home_url' ) ) {
	function home_url( $p = '/' ) { return 'https://ejemplo.test' . $p; }
}
if ( ! function_exists( 'site_url' ) ) {
	function site_url( $p = '/' ) { return 'https://ejemplo.test' . $p; }
}
if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $u, $c = -1 ) { return parse_url( (string) $u, $c ); }
}
if ( ! function_exists( 'wp_allowed_protocols' ) ) {
	function wp_allowed_protocols() { return [ 'http', 'https', 'mailto', 'tel' ]; }
}
if ( ! function_exists( 'post_type_exists' ) ) {
	function post_type_exists( $t ) { return false; }
}
if ( ! function_exists( 'shortcode_exists' ) ) {
	function shortcode_exists( $t ) { return false; }
}
if ( ! function_exists( 'get_posts' ) ) {
	function get_posts( $a = [] ) { return []; }
}
if ( ! function_exists( 'get_pages' ) ) {
	function get_pages( $a = [] ) { return []; }
}
if ( ! function_exists( 'wp_get_nav_menus' ) ) {
	function wp_get_nav_menus( $a = [] ) { return []; }
}
if ( ! function_exists( 'get_categories' ) ) {
	function get_categories( $a = [] ) { return []; }
}
if ( ! function_exists( 'get_post_meta' ) ) {
	function get_post_meta( ...$a ) { return ''; }
}
if ( ! function_exists( 'number_format_i18n' ) ) {
	function number_format_i18n( $n, $d = 0 ) { return number_format( (float) $n, (int) $d ); }
}
if ( ! function_exists( 'get_template_directory' ) ) {
	function get_template_directory() { return dirname( __DIR__ ) . '/krg-cms'; }
}
if ( ! function_exists( 'get_template_directory_uri' ) ) {
	function get_template_directory_uri() { return 'https://ejemplo.test/wp-content/themes/krg-cms'; }
}
if ( ! function_exists( 'update_option' ) ) {
	function update_option( $k, $v, $a = null ) { $GLOBALS['krg_options'][ $k ] = $v; return true; }
}
if ( ! function_exists( 'add_option' ) ) {
	function add_option( $k, $v = '', $d = '', $a = 'yes' ) { return update_option( $k, $v ); }
}
if ( ! function_exists( 'delete_option' ) ) {
	function delete_option( $k ) { unset( $GLOBALS['krg_options'][ $k ] ); return true; }
}
if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $k ) { return false; }
}
if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $k, $v, $t = 0 ) { return true; }
}
if ( ! function_exists( 'delete_transient' ) ) {
	function delete_transient( $k ) { return true; }
}
if ( ! function_exists( 'wp_cache_flush' ) ) {
	function wp_cache_flush() { return true; }
}
if ( ! function_exists( 'trailingslashit' ) ) {
	function trailingslashit( $s ) { return rtrim( (string) $s, '/\\' ) . '/'; }
}
if ( ! function_exists( 'untrailingslashit' ) ) {
	function untrailingslashit( $s ) { return rtrim( (string) $s, '/\\' ); }
}
if ( ! function_exists( 'wp_normalize_path' ) ) {
	function wp_normalize_path( $p ) { return str_replace( '\\', '/', (string) $p ); }
}
