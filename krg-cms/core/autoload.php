<?php
/**
 * PSR-4-ish autoload for Meridian\*.
 *
 * @package Meridian
 */

defined( 'ABSPATH' ) || exit;

spl_autoload_register(
	static function ( $class ) {
		$prefix = 'Meridian\\';
		if ( ! str_starts_with( $class, $prefix ) ) {
			return;
		}
		$relative = substr( $class, strlen( $prefix ) );
		$parts    = explode( '\\', $relative );
		$file     = array_pop( $parts );
		$dir      = MERIDIAN_PATH . '/core';
		foreach ( $parts as $part ) {
			$dir .= '/' . strtolower( $part );
		}
		$path = $dir . '/' . $file . '.php';
		if ( is_readable( $path ) ) {
			require_once $path;
		}
	}
);
