<?php
/**
 * Breakpoints from tokens.
 *
 * @package Meridian
 */

namespace Meridian\Style;

defined( 'ABSPATH' ) || exit;

class Breakpoints {

	public static function tablet(): int {
		$t = \Meridian\Design\TokenRepository::get();
		$v = $t['tokens']['breakpoint']['tablet']['value'] ?? '768px';
		return (int) $v;
	}

	public static function desktop(): int {
		$t = \Meridian\Design\TokenRepository::get();
		$v = $t['tokens']['breakpoint']['desktop']['value'] ?? '1024px';
		return (int) $v;
	}
}
