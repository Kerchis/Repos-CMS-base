<?php
/**
 * Constants.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

define( 'MERIDIAN_VERSION', '1.14.0' );
define( 'MERIDIAN_PATH', get_template_directory() );
define( 'MERIDIAN_URI', get_template_directory_uri() );
define( 'MERIDIAN_REST', 'krg/v1' );

/**
 * Version de un archivo del tema para romper la cache del navegador.
 *
 * Por que no vale la constante de arriba: es un numero escrito a mano. Si
 * se suben archivos nuevos sin tocarla, el navegador —y cualquier CDN o
 * plugin de cache por delante— sigue sirviendo el CSS y el JavaScript
 * viejos con la misma URL. Desde fuera parece que el arreglo «no hizo
 * nada»: el PHP es nuevo y la interfaz que se ejecuta es la de antes.
 *
 * Con la fecha del propio archivo, cada subida invalida su cache sola y
 * no hay ningun paso manual que recordar.
 *
 * @param string $rel Ruta dentro del tema, p. ej. '/assets/css/base.css'.
 */
function meridian_ver( string $rel ): string {
	$file = MERIDIAN_PATH . $rel;
	$time = is_readable( $file ) ? (int) filemtime( $file ) : 0;
	return $time ? MERIDIAN_VERSION . '.' . $time : MERIDIAN_VERSION;
}
/**
 * Preset de design system que se instala por defecto.
 * Cambiarlo (o filtrar `meridian_default_preset`) es lo único necesario para
 * que KRG CMS adopte otro lenguaje visual de referencia.
 */
define( 'MERIDIAN_DEFAULT_PRESET', 'honeycomb' );
define( 'MERIDIAN_META_DRAFT', '_meridian_draft' );
define( 'MERIDIAN_META_PUBLISHED', '_meridian_published' );
define( 'MERIDIAN_META_ENABLED', '_meridian_enabled' );
define( 'MERIDIAN_META_CHECKSUM', '_meridian_checksum' );
define( 'MERIDIAN_OPTION_TOKENS', 'meridian_tokens' );
define( 'MERIDIAN_OPTION_PRESETS', 'meridian_presets' );
define( 'MERIDIAN_OPTION_ADMIN_SKIN', 'meridian_admin_skin' );
define( 'MERIDIAN_OPTION_ADMIN_THEME', 'meridian_admin_theme' );
define( 'MERIDIAN_OPTION_SETTINGS', 'meridian_settings' );
define( 'MERIDIAN_OPTION_HEADER', 'meridian_header' );
define( 'MERIDIAN_OPTION_FOOTER', 'meridian_footer' );
define( 'MERIDIAN_OPTION_MENUS', 'meridian_menus' );
define( 'MERIDIAN_OPTION_SEO', 'meridian_seo_global' );
define( 'MERIDIAN_OPTION_IDENTITY', 'meridian_identity' );
define( 'MERIDIAN_OPTION_ROLE_CAPS', 'meridian_role_caps' );
// Ajustes del blog que valen para toda la web (ver `Content\BlogSettings`).
define( 'MERIDIAN_OPTION_BLOG', 'meridian_blog' );
