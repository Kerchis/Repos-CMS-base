<?php
/**
 * Escupe la piel del CMS en JSON, como la devolveria GET /admin-skin.
 *
 * Lo usa tools/prueba-piel.mjs para que el banco del navegador trabaje
 * con los temas de verdad y no con una copia a mano que se queda vieja.
 *
 *   .tools/php/php tools/dump-piel.php
 */

define( 'ABSPATH', __DIR__ . '/' );

$GLOBALS['krg_opt'] = [];
function get_option( $k, $def = false ) {
	return array_key_exists( $k, $GLOBALS['krg_opt'] ) ? $GLOBALS['krg_opt'][ $k ] : $def; }
function update_option( $k, $v, $auto = null ) {
	$GLOBALS['krg_opt'][ $k ] = $v;
	return true; }
function delete_option( $k ) {
	unset( $GLOBALS['krg_opt'][ $k ] );
	return true; }
function sanitize_hex_color( $c ) {
	return preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', trim( (string) $c ) ) ? trim( (string) $c ) : null; }
function __( $t, $d = null ) {
	return $t; }
function get_template_directory() {
	return dirname( __DIR__ ) . '/krg-cms'; }
function get_template_directory_uri() {
	return 'https://ejemplo.test/wp-content/themes/krg-cms'; }

require_once __DIR__ . '/../krg-cms/core/constants.php';
require_once __DIR__ . '/../krg-cms/core/admin/Skin.php';

use Meridian\Admin\Skin;

echo json_encode(
	[
		'data'     => Skin::get(),
		'defaults' => Skin::defaults(),
		'suggest'  => Skin::defaults(),
		'theme'    => Skin::tema(),
		'themes'   => Skin::temas(),
		'css'      => Skin::css(),
	],
	JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
