<?php
/**
 * Per-document CSS from node styles + layout helpers.
 *
 * @package Meridian
 */

namespace Meridian\Style;

defined( 'ABSPATH' ) || exit;

class DocumentCssCompiler {

	private const STYLE_PROPS = [
		'padding',
		'padding-top',
		'padding-right',
		'padding-bottom',
		'padding-left',
		'margin',
		'margin-top',
		'margin-right',
		'margin-bottom',
		'margin-left',
		'text-align',
		'color',
		'background',
		'background-color',
		'order',
		'max-width',
		'max-height',
		'min-width',
		'min-height',
		'width',
		'height',
		'display',
		'gap',
		'font-size',
		'font-weight',
		'font-family',
		'font-style',
		'letter-spacing',
		'line-height',
		'text-transform',
		'text-decoration',
		'border-radius',
		'opacity',
		'justify-content',
		'align-items',
		'grid-template-columns',
		'object-fit',
		'object-position',
		'filter',
		'box-shadow',
		'border',
		'border-width',
		'border-style',
		'border-color',
		'border-top-left-radius',
		'border-top-right-radius',
		'border-bottom-right-radius',
		'border-bottom-left-radius',
		'transition',
		'transition-duration',
		'transition-delay',
		'transition-timing-function',
		'animation-duration',
		'animation-delay',
		'animation-timing-function',
	];

	private const GRID_TYPES = [ 'cards-grid', 'feature-grid', 'logo-grid', 'blog-grid', 'statistics' ];

	public static function visibility_css(): string {
		$tablet  = Breakpoints::tablet();
		$desktop = Breakpoints::desktop();
		return '@media (min-width:' . $desktop . 'px){.m-hide-desktop{display:none!important}}'
			. '@media (min-width:' . $tablet . 'px) and (max-width:' . ( $desktop - 1 ) . 'px){.m-hide-tablet{display:none!important}}'
			. '@media (max-width:' . ( $tablet - 1 ) . 'px){.m-hide-mobile{display:none!important}}';
	}

	public static function for_current_request(): string {
		$doc = \Meridian\Render\PageRenderer::current_document();
		if ( ! $doc ) {
			$id = get_queried_object_id();
			if ( $id && is_page() ) {
				$state = \Meridian\Render\Preview::is_preview() ? 'draft' : 'published';
				$doc   = \Meridian\Content\PageRepository::get( $id, $state );
			}
		}
		$header = get_option( MERIDIAN_OPTION_HEADER );
		$footer = get_option( MERIDIAN_OPTION_FOOTER );
		$css    = '';
		if ( is_array( $header ) ) {
			$css .= self::compile( $header );
		}
		if ( is_array( $doc ) ) {
			$css .= self::compile( $doc );
		}
		if ( is_array( $footer ) ) {
			$css .= self::compile( $footer );
		}
		return $css;
	}

	public static function compile( array $doc ): string {
		$tablet  = Breakpoints::tablet();
		$desktop = Breakpoints::desktop();
		$base    = [];
		$tab     = [];
		$mob     = [];
		$extra   = [];

		$walk = static function ( array $nodes ) use ( &$walk, &$base, &$tab, &$mob, &$extra ) {
			foreach ( $nodes as $n ) {
				$id = sanitize_html_class( $n['id'] ?? '' );
				if ( $id ) {
					$sel = '.m-n-' . $id;
					self::push_styles( $sel, $n['styles']['desktop'] ?? [], $base );
					self::push_styles( $sel, $n['styles']['tablet'] ?? [], $tab );
					self::push_styles( $sel, $n['styles']['mobile'] ?? [], $mob );
					$type = $n['type'] ?? '';
					if ( 'row' === $type ) {
						$g       = max( 0, (int) ( $n['props']['gap'] ?? 24 ) );
						$va      = (string) ( $n['props']['vAlign'] ?? 'start' );
						if ( ! in_array( $va, [ 'start', 'center', 'end', 'stretch' ], true ) ) {
							$va = 'start';
						}
						$extra[] = "{$sel}{display:grid;gap:{$g}px;grid-template-columns:repeat(12,minmax(0,1fr));align-items:{$va};}";
					}
					if ( 'column' === $type ) {
						$d       = max( 1, min( 12, (int) ( $n['props']['span'] ?? 12 ) ) );
						$t       = max( 1, min( 12, (int) ( $n['props']['spanTablet'] ?? $d ) ) );
						$m       = max( 1, min( 12, (int) ( $n['props']['spanMobile'] ?? 12 ) ) );
						$cv      = (string) ( $n['props']['contentVAlign'] ?? 'start' );
						$ch      = (string) ( $n['props']['contentHAlign'] ?? 'start' );
						$col     = "grid-column:span {$d};min-width:0;";
						if ( in_array( $cv, [ 'center', 'end' ], true ) || in_array( $ch, [ 'center', 'end' ], true ) ) {
							$jc   = 'center' === $cv ? 'center' : ( 'end' === $cv ? 'flex-end' : 'flex-start' );
							$ai   = 'center' === $ch ? 'center' : ( 'end' === $ch ? 'flex-end' : 'flex-start' );
							$col .= "display:flex;flex-direction:column;justify-content:{$jc};align-items:{$ai};height:100%;";
						}
						$extra[] = "{$sel}{{$col}}";
						$tab[]   = "{$sel}{grid-column:span {$t};}";
						$mob[]   = "{$sel}{grid-column:span {$m};}";
					}
					if ( 'image' === $type && ( $n['props']['fillMode'] ?? '' ) === 'fill' ) {
						$fit = (string) ( $n['props']['objectFit'] ?? 'cover' );
						if ( ! in_array( $fit, [ 'cover', 'contain', 'fill' ], true ) ) {
							$fit = 'cover';
						}
						$extra[] = ".m-row:has({$sel}){align-items:stretch;}";
						$extra[] = ".m-col:has({$sel}){display:flex;flex-direction:column;height:100%;}";
						$extra[] = "{$sel}{flex:1 1 auto;height:100%;min-height:0;overflow:hidden;}";
						$extra[] = "{$sel} img{width:100%;height:100%;object-fit:{$fit};max-width:none;}";
					}
					if ( 'columns' === $type ) {
						[ $d, $t, $m ] = self::cols( $n['props'] ?? [], 3, 2, 1 );
						$g             = max( 0, (int) ( $n['props']['gap'] ?? 24 ) );
						$extra[]       = "{$sel}{display:grid;gap:{$g}px;grid-template-columns:repeat({$d},minmax(0,1fr));}";
						$tab[]         = "{$sel}{grid-template-columns:repeat({$t},minmax(0,1fr));}";
						$mob[]         = "{$sel}{grid-template-columns:repeat({$m},minmax(0,1fr));}";
					}
					if ( 'gallery' === $type && ( $n['props']['layout'] ?? 'carousel' ) === 'grid' ) {
						[ $d, $t, $m ] = self::cols( $n['props'] ?? [], 3, 2, 1 );
						$extra[]       = "{$sel} .m-grid, {$sel}.m-grid{display:grid;gap:var(--spacing-lg);grid-template-columns:repeat({$d},minmax(0,1fr));}";
						$tab[]         = "{$sel} .m-grid, {$sel}.m-grid{grid-template-columns:repeat({$t},minmax(0,1fr));}";
						$mob[]         = "{$sel} .m-grid, {$sel}.m-grid{grid-template-columns:repeat({$m},minmax(0,1fr));}";
					}
					if ( in_array( $type, self::GRID_TYPES, true ) ) {
						[ $d, $t, $m ] = self::cols( $n['props'] ?? [], 3, 2, 1 );
						$extra[]       = "{$sel} .m-grid, {$sel}.m-grid{display:grid;gap:var(--spacing-lg);grid-template-columns:repeat({$d},minmax(0,1fr));}";
						$tab[]         = "{$sel} .m-grid, {$sel}.m-grid{grid-template-columns:repeat({$t},minmax(0,1fr));}";
						$mob[]         = "{$sel} .m-grid, {$sel}.m-grid{grid-template-columns:repeat({$m},minmax(0,1fr));}";
					}
					$filt = self::filter_decl( $n['filters'] ?? [] );
					if ( $filt ) {
						$extra[] = $sel . '{filter:' . $filt . ';}';
					}
					$anim = sanitize_key( (string) ( $n['animation'] ?? 'none' ) );
					if ( $anim && 'none' !== $anim ) {
						$dur  = max( 0, absint( $n['animDuration'] ?? 600 ) );
						$del  = max( 0, absint( $n['animDelay'] ?? 0 ) );
						$ease = (string) ( $n['animEasing'] ?? 'ease' );
						if ( ! in_array( $ease, [ 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out' ], true ) ) {
							$ease = 'ease';
						}
						$extra[] = $sel . '{animation-duration:' . $dur . 'ms;animation-delay:' . $del . 'ms;animation-timing-function:' . $ease . ';}';
					}
					$scoped = self::scoped_css( $sel, $n['customCss'] ?? [] );
					if ( $scoped ) {
						$extra[] = $scoped;
					}
				}
				if ( ! empty( $n['children'] ) ) {
					$walk( $n['children'] );
				}
			}
		};
		$walk( $doc['sections'] ?? ( isset( $doc['type'] ) ? [ $doc ] : [] ) );
		if ( isset( $doc['children'] ) ) {
			$walk( [ $doc ] );
		}

		$css = implode( '', $extra ) . implode( '', $base );
		if ( $tab ) {
			$css .= '@media (max-width:' . ( $desktop - 1 ) . 'px){' . implode( '', $tab ) . '}';
		}
		if ( $mob ) {
			$css .= '@media (max-width:' . ( $tablet - 1 ) . 'px){' . implode( '', $mob ) . '}';
		}
		return $css;
	}

	/**
	 * @return array{0:int,1:int,2:int}
	 */
	private static function cols( array $props, int $d, int $t, int $m ): array {
		$desktop = max( 1, min( 6, (int) ( $props['desktop'] ?? $props['columns'] ?? $d ) ) );
		$tablet  = max( 1, min( 6, (int) ( $props['tablet'] ?? min( 2, $desktop ) ) ) );
		$mobile  = max( 1, min( 4, (int) ( $props['mobile'] ?? 1 ) ) );
		return [ $desktop, $tablet, $mobile ];
	}

	private static function push_styles( string $sel, array $styles, array &$bucket ): void {
		if ( ! $styles ) {
			return;
		}
		$decls = [];
		$text  = [];
		$img   = [];
		foreach ( $styles as $p => $v ) {
			$prop = strtolower( (string) $p );
			if ( ! in_array( $prop, self::STYLE_PROPS, true ) ) {
				continue;
			}
			$val = self::safe_value( (string) $v );
			if ( $val === '' ) {
				continue;
			}
			$decl = $prop . ':' . $val . '!important';
			if ( in_array( $prop, [ 'color', 'font-size', 'font-weight', 'font-family', 'font-style', 'letter-spacing', 'line-height', 'text-transform', 'text-decoration' ], true ) ) {
				$text[] = $decl;
			} else {
				$decls[] = $decl;
			}
			if ( in_array( $prop, [ 'width', 'height', 'max-width', 'max-height', 'object-fit', 'object-position', 'border-radius', 'box-shadow', 'filter', 'border-width', 'border-style', 'border-color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius' ], true ) ) {
				$img[] = $decl;
			}
		}
		if ( ( $styles['text-align'] ?? '' ) === 'center' ) {
			$decls[] = 'margin-left:auto!important';
			$decls[] = 'margin-right:auto!important';
		}
		if ( $decls ) {
			$bucket[] = $sel . '{' . implode( ';', $decls ) . ';}';
		}
		if ( $text ) {
			$bucket[] = $sel . ',' . $sel . ' :is(h1,h2,h3,h4,h5,h6,p,li,.m-hero-title,.m-hero-sub,.m-heading,.m-eyebrow,.m-role-h1,.m-role-h2,.m-role-h3,.m-paragraph){' . implode( ';', $text ) . ';}';
		}
		if ( $img ) {
			$bucket[] = $sel . ' img{' . implode( ';', $img ) . ';}';
		}
	}

	private static function safe_value( string $v ): string {
		$v = trim( $v );
		if ( $v === '' || str_contains( $v, '<') || str_contains( strtolower( $v ), 'expression' ) || str_contains( strtolower( $v ), 'javascript' ) ) {
			return '';
		}
		if ( ! preg_match( '/^[a-zA-Z0-9#%,.\s()\/\-_]+$/', $v ) ) {
			return '';
		}
		return $v;
	}

	private static function filter_decl( $filters ): string {
		if ( ! is_array( $filters ) ) {
			return '';
		}
		$h = isset( $filters['hue'] ) ? (float) $filters['hue'] : 0;
		$s = isset( $filters['sat'] ) ? (float) $filters['sat'] : 100;
		$b = isset( $filters['brightness'] ) ? (float) $filters['brightness'] : 100;
		$c = isset( $filters['contrast'] ) ? (float) $filters['contrast'] : 100;
		$i = isset( $filters['invert'] ) ? (float) $filters['invert'] : 0;
		$p = isset( $filters['sepia'] ) ? (float) $filters['sepia'] : 0;
		if ( ! $h && 100.0 === $s && 100.0 === $b && 100.0 === $c && ! $i && ! $p ) {
			return '';
		}
		return 'hue-rotate(' . $h . 'deg) saturate(' . $s . '%) brightness(' . $b . '%) contrast(' . $c . '%) invert(' . $i . '%) sepia(' . $p . '%)';
	}

	private static function scoped_css( string $sel, $fields ): string {
		if ( ! is_array( $fields ) ) {
			return '';
		}
		$out  = '';
		$main = trim( (string) ( $fields['main'] ?? '' ) );
		$bef  = trim( (string) ( $fields['before'] ?? '' ) );
		$aft  = trim( (string) ( $fields['after'] ?? '' ) );
		if ( $main ) {
			$out .= $sel . '{' . $main . '}';
		}
		if ( $bef ) {
			$out .= $sel . '::before{content:"";display:block;' . $bef . '}';
		}
		if ( $aft ) {
			$out .= $sel . '::after{content:"";display:block;' . $aft . '}';
		}
		return $out;
	}
}
