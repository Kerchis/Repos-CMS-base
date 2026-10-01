<?php
/**
 * Constants.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

define( 'MERIDIAN_VERSION', '1.13.49' );
define( 'MERIDIAN_PATH', get_template_directory() );
define( 'MERIDIAN_URI', get_template_directory_uri() );
define( 'MERIDIAN_REST', 'krg/v1' );
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
define( 'MERIDIAN_OPTION_SETTINGS', 'meridian_settings' );
define( 'MERIDIAN_OPTION_HEADER', 'meridian_header' );
define( 'MERIDIAN_OPTION_FOOTER', 'meridian_footer' );
define( 'MERIDIAN_OPTION_MENUS', 'meridian_menus' );
define( 'MERIDIAN_OPTION_SEO', 'meridian_seo_global' );
define( 'MERIDIAN_OPTION_IDENTITY', 'meridian_identity' );
define( 'MERIDIAN_OPTION_ROLE_CAPS', 'meridian_role_caps' );
