<?php
/**
 * Disable Gutenberg on KRG CMS pages.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Gutenberg {

	public static function disable_for_pages( $use, $post_type ) {
		if ( 'page' === $post_type ) {
			return false;
		}
		return $use;
	}
}
