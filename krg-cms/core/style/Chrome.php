<?php
/**
 * Header/footer CSS from admin settings.
 *
 * @package Meridian
 */

namespace Meridian\Style;

defined( 'ABSPATH' ) || exit;

class Chrome {

	public static function css(): string {
		$h = \Meridian\Navigation\Menus::header();
		$f = \Meridian\Navigation\Menus::footer();
		$bg = self::color( $h['background'] ?? 'var(--color-background)', 'var(--color-background)' );
		$fg = self::color( $h['color'] ?? 'var(--color-text)', 'var(--color-text)' );
		$fbg = self::color( $f['background'] ?? 'var(--color-secondary)', 'var(--color-secondary)' );
		$ffg = self::color( $f['color'] ?? 'var(--color-on-secondary, #fff)', 'var(--color-on-secondary, #fff)' );
		$flink = self::color( (string) ( $f['linkColor'] ?? '' ), $ffg );
		$fhead = self::color( (string) ( $f['headingColor'] ?? '' ), $ffg );
		$fcop  = self::color( (string) ( $f['copyrightColor'] ?? '' ), $ffg );
		$pad = max( 0, absint( $h['paddingY'] ?? 12 ) );
		$fpad = max( 0, absint( $f['paddingY'] ?? 64 ) );
		$cols = max( 1, min( 4, absint( $f['columns'] ?? 3 ) ) );
		$h_h = max( 48, absint( $h['height'] ?? 72 ) );
		$trans = ! empty( $h['transparent'] );
		$op    = max( 0, min( 100, absint( $h['transOpacity'] ?? 0 ) ) );
		$blend = \Meridian\Navigation\Menus::blend_mode( (string) ( $h['transBlend'] ?? 'normal' ) );
		$blur  = max( 0, min( 40, absint( $h['transBlur'] ?? 20 ) ) );
		$glass = self::color( (string) ( $h['transColor'] ?? '#ffffff' ) );
		$logo_r = \Meridian\Navigation\Menus::corner_radius_css( (string) ( $h['logoRadius'] ?? 'none' ) );
		$logo_w = max( 16, min( 480, absint( $h['logoWidth'] ?? 140 ) ) );
		$logo_wt = max( 16, min( 480, absint( $h['logoWidthTablet'] ?? $logo_w ) ) );
		$logo_wm = max( 16, min( 480, absint( $h['logoWidthMobile'] ?? 120 ) ) );
		$nhfg   = self::color( (string) ( $h['navHoverFg'] ?? '' ), 'var(--color-primary)' );
		$nhbg   = trim( (string) ( $h['navHoverBg'] ?? '' ) );
		$nhbg_c = $nhbg === '' ? 'transparent' : self::color( $nhbg, 'transparent' );
		$flh    = self::color( (string) ( $f['linkHoverFg'] ?? '' ), 'var(--color-primary)' );
		$flhb   = trim( (string) ( $f['linkHoverBg'] ?? '' ) );
		$flhb_c = $flhb === '' ? 'transparent' : self::color( $flhb, 'transparent' );
		$header_bg = $trans ? 'transparent' : $bg;
		$lines = [
			'.m-site-header{background:' . $header_bg . ';color:' . $fg . ';min-height:' . $h_h . 'px;--m-header-bg:' . $bg . ';--m-header-fg:' . $fg . ';--m-header-glass:' . $glass . ';--m-header-op:' . $op . '%;--m-header-blend:' . $blend . ';--m-header-blur:' . $blur . 'px;--m-logo-radius:' . $logo_r . ';--m-logo-w:' . $logo_w . 'px;--m-logo-w-tablet:' . $logo_wt . 'px;--m-logo-w-mobile:' . $logo_wm . 'px;--m-nav-hover-fg:' . $nhfg . ';--m-nav-hover-bg:' . $nhbg_c . ';}',
			'.m-site-header .m-logo img{border-radius:var(--m-logo-radius,0);width:var(--m-logo-w,140px);max-width:100%;height:auto;}',
			'@media(max-width:1023px){.m-site-header .m-logo img{width:var(--m-logo-w-tablet,var(--m-logo-w,140px))}}',
			'@media(max-width:767px){.m-site-header .m-logo img{width:var(--m-logo-w-mobile,var(--m-logo-w-tablet,120px))}}',
			'.m-site-header .m-header-inner{padding-block:' . $pad . 'px;}',
			'.m-site-header .m-nav-list a,.m-site-header .m-logo-text,.m-site-header .m-nav-toggle,.m-site-header a:not(.m-btn){color:' . $fg . ';}',
			'.m-site-header .m-nav-list a:hover,.m-site-header .m-nav-list a:focus-visible,.m-site-header .m-nav-list .is-current > a{color:' . $nhfg . ';background:' . $nhbg_c . ';}',
			'.m-site-footer{background:' . $fbg . ';color:' . $ffg . ';padding-top:' . $fpad . 'px;--m-footer-bg:' . $fbg . ';--m-footer-fg:' . $ffg . ';--m-footer-link:' . $flink . ';--m-footer-heading:' . $fhead . ';--m-footer-link-hover:' . $flh . ';--m-footer-link-hover-bg:' . $flhb_c . ';}',
			'.m-site-footer a:not(.m-btn),.m-site-footer .m-logo-text{color:' . $flink . ';}',
			'.m-site-footer a:not(.m-btn):hover,.m-site-footer .m-nav-list a:hover{color:' . $flh . ';background:' . $flhb_c . ';}',
			'.m-site-footer h1,.m-site-footer h2,.m-site-footer h3,.m-site-footer h4,.m-site-footer strong{color:' . $fhead . ';}',
			'.m-site-footer .m-copyright{color:' . $fcop . ';}',
			'.m-footer-grid{grid-template-columns:repeat(' . $cols . ',minmax(0,1fr));}',
		];
		$fa = $f['align'] ?? 'left';
		if ( 'center' === $fa ) {
			$lines[] = '.m-site-footer .m-footer-grid,.m-site-footer .m-footer-sections{text-align:center;justify-items:center;}';
		} elseif ( 'right' === $fa ) {
			$lines[] = '.m-site-footer .m-footer-grid,.m-site-footer .m-footer-sections{text-align:right;justify-items:end;}';
		}
		$fva = $f['vAlign'] ?? 'start';
		if ( 'center' === $fva ) {
			$lines[] = '.m-site-footer .m-footer-grid{align-items:center;}';
		} elseif ( 'end' === $fva ) {
			$lines[] = '.m-site-footer .m-footer-grid{align-items:end;}';
		}
		if ( ( $f['distribute'] ?? '' ) === 'x' ) {
			$lines[] = '.m-site-footer .m-footer-grid{justify-content:space-between;}';
		}
		$cfam = \Meridian\Design\TokenCompiler::safe_css( (string) ( $f['copyrightFont'] ?? '' ) );
		$cw   = preg_replace( '/[^0-9]/', '', (string) ( $f['copyrightWeight'] ?? '' ) );
		$cs   = in_array( ( $f['copyrightStyle'] ?? '' ), [ 'italic', 'oblique' ], true ) ? (string) $f['copyrightStyle'] : '';
		$cz   = max( 10, min( 48, absint( $f['copyrightSize'] ?? 13 ) ) );
		$ca   = in_array( ( $f['copyrightAlign'] ?? '' ), [ 'left', 'center', 'right' ], true ) ? (string) $f['copyrightAlign'] : 'left';
		$cbg  = trim( (string) ( $f['copyrightBg'] ?? '' ) );
		$copy_css = '.m-site-footer .m-copyright{text-align:' . $ca . ';font-size:' . $cz . 'px;';
		if ( $cfam ) {
			$copy_css .= 'font-family:' . $cfam . ';';
		}
		if ( $cw ) {
			$copy_css .= 'font-weight:' . $cw . ';';
		}
		if ( $cs ) {
			$copy_css .= 'font-style:' . $cs . ';';
		}
		if ( $cbg !== '' ) {
			$copy_css .= 'background:' . self::color( $cbg, 'transparent' ) . ';';
		}
		$copy_css .= '}';
		$lines[]   = $copy_css;
		$lines[]   = '.m-site-footer .m-copyright a{color:inherit;}';
		if ( $trans ) {
			$lines[] = '.m-site-header,.m-site-header.is-transparent{background:transparent!important;border-bottom-color:transparent;}';
		}
		if ( ( $h['align'] ?? 'left' ) === 'center' ) {
			$lines[] = '.m-header-inner{justify-content:center;flex-wrap:wrap;}';
		}
		if ( ( $h['align'] ?? 'left' ) === 'right' ) {
			$lines[] = '.m-header-inner{justify-content:flex-end;flex-wrap:wrap;}';
		}
		$va = $h['vAlign'] ?? 'center';
		if ( 'start' === $va ) {
			$lines[] = '.m-header-inner{align-items:flex-start;}';
		} elseif ( 'end' === $va ) {
			$lines[] = '.m-header-inner{align-items:flex-end;}';
		}
		$desk = Breakpoints::desktop();
		$lines[] = '@media(max-width:' . ( $desk - 1 ) . 'px){.m-logo-desktop{display:none}.m-logo-mobile{display:block}.m-footer-grid{grid-template-columns:1fr;}}';
		$lines[] = '@media(min-width:' . $desk . 'px){.m-logo-mobile{display:none}}';
		return implode( '', $lines );
	}

	private static function color( string $v, string $fallback = 'var(--color-background)' ): string {
		$v = trim( $v );
		if ( $v === '' ) {
			return $fallback;
		}
		if ( str_starts_with( $v, 'var(' ) ) {
			return \Meridian\Design\TokenCompiler::safe_css( $v );
		}
		if ( str_starts_with( $v, 'color.' ) ) {
			return \Meridian\Design\TokenCompiler::token_var( $v );
		}
		$hex = sanitize_hex_color( $v );
		return $hex ?: $fallback;
	}
}
