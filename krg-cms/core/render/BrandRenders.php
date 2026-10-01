<?php
/**
 * HTML for the reference-derived component library.
 *
 * Reglas:
 *  - El contenido SIEMPRE viene de props (nunca copy escrito aquí).
 *  - Todo se escapa en el punto de salida.
 *  - Las clases usan el prefijo `m-` y las variantes `is-*` para que el CSS
 *    sea un sistema y no una hoja por página.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class BrandRenders {

	private const THEMES    = [ 'light', 'cream', 'surface', 'forest', 'dark' ];
	private const TRACKINGS = [ 'tight', 'normal', 'wide', 'wider' ];

	/* ------------------------------------------------------------------ */
	/* Helpers                                                             */
	/* ------------------------------------------------------------------ */

	private static function theme( $v, string $fallback = 'cream' ): string {
		$v = sanitize_html_class( (string) $v );
		return in_array( $v, self::THEMES, true ) ? $v : $fallback;
	}

	private static function tracking( $v, string $fallback = 'normal' ): string {
		$v = sanitize_html_class( (string) $v );
		return in_array( $v, self::TRACKINGS, true ) ? $v : $fallback;
	}

	private static function align( $v, string $fallback = 'left' ): string {
		$v = sanitize_html_class( (string) $v );
		return in_array( $v, [ 'left', 'center', 'right' ], true ) ? $v : $fallback;
	}

	private static function tag( $v, string $fallback = 'h2' ): string {
		$v = sanitize_html_class( (string) $v );
		return in_array( $v, [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p' ], true ) ? $v : $fallback;
	}

	private static function opt( $v, array $allowed, string $fallback ): string {
		$v = sanitize_html_class( (string) $v );
		return in_array( $v, $allowed, true ) ? $v : $fallback;
	}

	/** Reparte un texto en letras envueltas para el revelado escalonado. */
	private static function letters( string $text ): string {
		$out   = '';
		$chars = preg_split( '//u', $text, -1, PREG_SPLIT_NO_EMPTY ) ?: [];
		$i     = 0;
		foreach ( $chars as $ch ) {
			if ( ' ' === $ch ) {
				$out .= '<span class="m-ch is-space" aria-hidden="true"> </span>';
				continue;
			}
			$delay = min( 600, $i * 22 );
			$out  .= '<span class="m-ch" aria-hidden="true" style="--m-ch-delay:' . $delay . 'ms">' . esc_html( $ch ) . '</span>';
			$i++;
		}
		return $out;
	}

	/** Título con revelado opcional por letra, accesible (texto real en sr-only). */
	private static function display_title( string $text, string $tag, string $classes, string $reveal = 'none' ): string {
		if ( '' === trim( $text ) ) {
			return '';
		}
		$lines = preg_split( '/\r\n|\r|\n/', $text ) ?: [ $text ];
		$inner = '';
		if ( 'letters' === $reveal ) {
			$inner .= '<span class="screen-reader-text">' . esc_html( $text ) . '</span>';
			foreach ( $lines as $line ) {
				$inner .= '<span class="m-line">' . self::letters( $line ) . '</span>';
			}
		} else {
			foreach ( $lines as $line ) {
				$inner .= '<span class="m-line">' . esc_html( $line ) . '</span>';
			}
		}
		$reveal_class = 'none' === $reveal ? '' : ' is-reveal-' . sanitize_html_class( $reveal );
		return '<' . $tag . ' class="' . esc_attr( $classes . $reveal_class ) . '" data-reveal="' . esc_attr( $reveal ) . '">' . $inner . '</' . $tag . '>';
	}

	/** Cabecera común: antetítulo + título + enlace. */
	private static function head( array $p, string $extra_class = '' ): string {
		$eyebrow  = trim( (string) ( $p['eyebrow'] ?? '' ) );
		$title    = trim( (string) ( $p['title'] ?? '' ) );
		$link_txt = trim( (string) ( $p['linkText'] ?? '' ) );
		$link_url = (string) ( $p['linkUrl'] ?? '' );
		if ( '' === $eyebrow && '' === $title && '' === $link_txt ) {
			return '';
		}
		$align    = self::align( $p['align'] ?? 'left' );
		$tracking = self::tracking( $p['tracking'] ?? 'normal' );
		$html     = '<div class="m-sec-head is-align-' . $align . ' ' . esc_attr( $extra_class ) . '">';
		$html    .= '<div class="m-sec-head-copy">';
		if ( '' !== $eyebrow ) {
			$html .= '<p class="m-eyebrow">' . esc_html( $eyebrow ) . '</p>';
		}
		$html .= self::display_title(
			$title,
			self::tag( $p['titleTag'] ?? 'h2' ),
			'm-sec-title m-track-' . $tracking,
			'letters' === ( $p['reveal'] ?? '' ) ? 'letters' : 'fade'
		);
		$html .= '</div>';
		if ( '' !== $link_txt ) {
			$html .= '<a class="m-btn m-btn-outline m-sec-link" href="' . esc_url( $link_url ?: '#' ) . '">' . esc_html( $link_txt ) . '</a>';
		}
		$html .= '</div>';
		return $html;
	}

	/** Columnas responsive como custom properties. */
	private static function col_vars( array $p, int $d = 3, int $t = 2, int $m = 1 ): string {
		$dd = max( 1, min( 6, absint( $p['desktop'] ?? $d ) ?: $d ) );
		$tt = max( 1, min( 4, absint( $p['tablet'] ?? $t ) ?: $t ) );
		$mm = max( 1, min( 3, absint( $p['mobile'] ?? $m ) ?: $m ) );
		return '--m-cols:' . $dd . ';--m-cols-t:' . $tt . ';--m-cols-m:' . $mm . ';';
	}

	private static function media( RenderContext $ctx, int $id, string $alt, string $class, string $size = 'large', bool $eager = false ): string {
		if ( ! $id ) {
			return '<span class="m-img-placeholder ' . esc_attr( $class ) . '" aria-hidden="true"></span>';
		}
		return ComponentRenders::img( $ctx, $id, $alt, $class, $size, $eager );
	}

	/** Tarjeta reutilizable usada por product-rail, collection-grid y filter-collection. */
	private static function card( RenderContext $ctx, array $it, string $style, string $ratio ): string {
		$title  = trim( (string) ( $it['title'] ?? '' ) );
		$cat    = trim( (string) ( $it['category'] ?? '' ) );
		$text   = trim( (string) ( $it['text'] ?? '' ) );
		$badge  = trim( (string) ( $it['badge'] ?? '' ) );
		$cta    = trim( (string) ( $it['linkText'] ?? '' ) );
		$url    = (string) ( $it['url'] ?? '' );
		$img_id = absint( $it['imageId'] ?? 0 );
		$alt    = (string) ( $it['alt'] ?? $title );

		$body  = '';
		if ( '' !== $cat ) {
			$body .= '<span class="m-card-cat">' . esc_html( $cat ) . '</span>';
		}
		if ( '' !== $title ) {
			$body .= '<span class="m-card-title">' . esc_html( $title ) . '</span>';
		}
		if ( '' !== $text ) {
			$body .= '<span class="m-card-text">' . esc_html( $text ) . '</span>';
		}
		if ( '' !== $cta ) {
			$body .= '<span class="m-card-cta">' . esc_html( $cta ) . '</span>';
		}

		$media = '<span class="m-card-media is-ratio-' . esc_attr( $ratio ) . '">'
			. self::media( $ctx, $img_id, $alt, 'm-card-img' )
			. ( '' !== $badge ? '<span class="m-card-badge">' . esc_html( $badge ) . '</span>' : '' )
			. '</span>';

		$inner = $media . '<span class="m-card-body">' . $body . '</span>';
		$class = 'm-bcard is-' . esc_attr( $style );

		if ( '' !== $url ) {
			return '<a class="' . $class . '" href="' . esc_url( $url ) . '">' . $inner . '</a>';
		}
		return '<div class="' . $class . '">' . $inner . '</div>';
	}

	private static function section_style( array $p ): string {
		$style = '';
		if ( isset( $p['padTop'] ) && '' !== $p['padTop'] ) {
			$style .= '--m-pad-top:' . absint( $p['padTop'] ) . 'px;';
		}
		if ( isset( $p['padBottom'] ) && '' !== $p['padBottom'] ) {
			$style .= '--m-pad-bottom:' . absint( $p['padBottom'] ) . 'px;';
		}
		return $style;
	}

	/* ------------------------------------------------------------------ */
	/* display-type                                                        */
	/* ------------------------------------------------------------------ */

	public static function display_type( array $node, array $props, string $children, RenderContext $ctx ): string {
		$size     = self::opt( $props['size'] ?? 'xl', [ 'display', 'xl', 'lg', 'md', 'sm' ], 'xl' );
		$tracking = self::tracking( $props['tracking'] ?? 'wide', 'wide' );
		$align    = self::align( $props['align'] ?? 'center', 'center' );
		$reveal   = self::opt( $props['reveal'] ?? 'letters', [ 'letters', 'fade', 'none' ], 'letters' );
		$tag      = self::tag( $props['tag'] ?? 'h2' );
		$mode     = self::opt( $props['colorMode'] ?? 'inherit', [ 'inherit', 'primary', 'secondary', 'background', 'custom' ], 'inherit' );

		$style = '';
		$max   = absint( $props['maxWidth'] ?? 0 );
		if ( $max > 0 ) {
			$style .= '--m-dt-max:' . $max . 'px;';
		}
		if ( 'custom' === $mode ) {
			$c = $props['color'] ?? [];
			if ( is_array( $c ) && ( $c['mode'] ?? '' ) === 'custom' && ! empty( $c['value'] ) ) {
				$hex = sanitize_hex_color( (string) $c['value'] );
				if ( $hex ) {
					$style .= '--m-dt-color:' . $hex . ';';
				}
			} elseif ( is_array( $c ) && ! empty( $c['token'] ) ) {
				$style .= '--m-dt-color:' . \Meridian\Design\TokenCompiler::token_var( (string) $c['token'] ) . ';';
			}
		}

		$inner = '';
		$eyebrow = trim( (string) ( $props['eyebrow'] ?? '' ) );
		if ( '' !== $eyebrow ) {
			$inner .= '<p class="m-eyebrow">' . esc_html( $eyebrow ) . '</p>';
		}
		$inner .= self::display_title( (string) ( $props['text'] ?? '' ), $tag, 'm-dt-text m-track-' . $tracking, $reveal );

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class' => 'm-dt is-size-' . $size . ' is-align-' . $align . ' is-color-' . $mode,
				'style' => $style,
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* marquee                                                             */
	/* ------------------------------------------------------------------ */

	public static function marquee( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values(
			array_filter(
				$items,
				static fn( $i ) => is_array( $i ) && '' !== trim( (string) ( $i['text'] ?? '' ) )
			)
		);
		if ( ! $items ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Añade textos a la marquesina.', 'meridian' ) . '</p>', [ 'class' => 'm-marquee is-empty' ] )
				: '';
		}

		$variant = self::opt( $props['variant'] ?? 'solid', [ 'solid', 'outline', 'plain', 'dark' ], 'solid' );
		$size    = self::opt( $props['size'] ?? 'md', [ 'sm', 'md', 'lg', 'xl' ], 'md' );
		$sep     = self::opt( $props['separator'] ?? 'dot', [ 'dot', 'star', 'slash', 'image', 'none' ], 'dot' );
		$dir     = ( ( $props['direction'] ?? 'left' ) === 'right' ) ? 'right' : 'left';
		$speed   = max( 5, min( 180, absint( $props['speed'] ?? 40 ) ) );
		$icon_id = absint( $props['iconId'] ?? 0 );
		$pause   = ! empty( $props['pauseHover'] );

		$glyphs = [ 'dot' => '&bull;', 'star' => '&#10022;', 'slash' => '/', 'none' => '', 'image' => '' ];

		$sep_html = '';
		if ( 'image' === $sep && $icon_id ) {
			$sep_html = '<span class="m-mq-sep is-img" aria-hidden="true">' . self::media( $ctx, $icon_id, '', 'm-mq-icon', 'thumbnail' ) . '</span>';
		} elseif ( isset( $glyphs[ $sep ] ) && '' !== $glyphs[ $sep ] ) {
			$sep_html = '<span class="m-mq-sep" aria-hidden="true">' . $glyphs[ $sep ] . '</span>';
		}

		$run = '';
		foreach ( $items as $it ) {
			$txt = (string) $it['text'];
			$url = (string) ( $it['url'] ?? '' );
			$lbl = '' !== $url
				? '<a class="m-mq-item" href="' . esc_url( $url ) . '">' . esc_html( $txt ) . '</a>'
				: '<span class="m-mq-item">' . esc_html( $txt ) . '</span>';
			$run .= $lbl . $sep_html;
		}

		// Dos pistas idénticas: una visible y otra duplicada para el bucle infinito.
		$inner = '<div class="m-mq-viewport">'
			. '<div class="m-mq-track">'
			. '<div class="m-mq-run">' . $run . '</div>'
			. '<div class="m-mq-run" aria-hidden="true">' . $run . '</div>'
			. '</div></div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'      => 'm-marquee is-' . $variant . ' is-size-' . $size . ' is-dir-' . $dir . ( $pause ? ' is-pausable' : '' ),
				'style'      => '--m-mq-speed:' . $speed . 's;',
				'data-marquee' => '1',
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* preloader                                                           */
	/* ------------------------------------------------------------------ */

	public static function preloader( array $node, array $props, string $children, RenderContext $ctx ): string {
		$label    = trim( (string) ( $props['label'] ?? '' ) );
		$claim    = trim( (string) ( $props['claim'] ?? '' ) );
		$duration = max( 400, min( 6000, absint( $props['duration'] ?? 1600 ) ) );
		$once     = ! empty( $props['once'] );
		$count    = ! empty( $props['showCount'] );
		$img      = absint( $props['imageId'] ?? 0 );

		$inner = '<div class="m-pl-inner">';
		if ( '' !== $label ) {
			$inner .= '<p class="m-pl-label">' . esc_html( $label ) . '</p>';
		}
		if ( $img ) {
			$inner .= '<div class="m-pl-mark">' . self::media( $ctx, $img, '', 'm-pl-img', 'medium', true ) . '</div>';
		}
		if ( $count ) {
			$inner .= '<p class="m-pl-count" data-pl-count>0%</p>';
			$inner .= '<div class="m-pl-bar"><span data-pl-bar></span></div>';
		}
		if ( '' !== $claim ) {
			$inner .= '<p class="m-pl-claim">' . esc_html( $claim ) . '</p>';
		}
		$inner .= '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'         => 'm-preloader',
				'data-preloader'=> '1',
				'data-duration' => $duration,
				'data-once'     => $once ? '1' : '0',
				'role'          => 'status',
				'aria-live'     => 'polite',
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* brand-hero                                                          */
	/* ------------------------------------------------------------------ */

	public static function brand_hero( array $node, array $props, string $children, RenderContext $ctx ): string {
		$variant = self::opt( $props['variant'] ?? 'center', [ 'center', 'left', 'split', 'compact' ], 'center' );
		$height  = self::opt( $props['height'] ?? 'tall', [ 'full', 'tall', 'medium', 'short' ], 'tall' );
		$theme   = self::theme( $props['theme'] ?? 'light', 'light' );
		$overlay = max( 0, min( 90, absint( $props['overlay'] ?? 30 ) ) );
		$img     = absint( $props['imageId'] ?? 0 );
		$img_m   = absint( $props['mobileImageId'] ?? 0 );

		$copy = '<div class="m-bh-copy">';
		if ( ! empty( $props['eyebrow'] ) ) {
			$copy .= '<p class="m-eyebrow">' . esc_html( (string) $props['eyebrow'] ) . '</p>';
		}
		$copy .= self::display_title( (string) ( $props['title'] ?? '' ), 'h1', 'm-bh-title m-track-wide', 'letters' );
		if ( ! empty( $props['subtitle'] ) ) {
			$copy .= self::display_title( (string) $props['subtitle'], 'p', 'm-bh-sub m-track-wide', 'fade' );
		}
		if ( ! empty( $props['subtitle2'] ) ) {
			$copy .= self::display_title( (string) $props['subtitle2'], 'p', 'm-bh-sub m-track-wide', 'fade' );
		}
		if ( ! empty( $props['text'] ) ) {
			$copy .= '<p class="m-bh-text">' . nl2br( esc_html( (string) $props['text'] ) ) . '</p>';
		}
		$btns = is_array( $props['buttons'] ?? null ) ? $props['buttons'] : [];
		$row  = '';
		foreach ( $btns as $b ) {
			if ( is_array( $b ) && '' !== trim( (string) ( $b['text'] ?? '' ) ) ) {
				$row .= ComponentRenders::btn( $b );
			}
		}
		if ( '' !== $row ) {
			$copy .= '<div class="m-btn-row">' . $row . '</div>';
		}
		$copy .= '</div>';

		$media = '';
		if ( $img || $img_m ) {
			$media  = '<div class="m-bh-media" aria-hidden="true">';
			if ( $img ) {
				$media .= self::media( $ctx, $img, '', 'm-bh-img is-desktop', 'full', true );
			}
			if ( $img_m ) {
				$media .= self::media( $ctx, $img_m, '', 'm-bh-img is-mobile', 'large', true );
			}
			$media .= '<span class="m-bh-veil" style="opacity:' . ( $overlay / 100 ) . '"></span>';
			$media .= '</div>';
			$ctx->needed['hero_img'] = true;
		}

		$hint = ! empty( $props['scrollHint'] )
			? '<span class="m-bh-scroll" aria-hidden="true"><span class="m-bh-scroll-dot"></span></span>'
			: '';

		$split_extra = '';
		if ( 'split' === $variant && $img ) {
			$split_extra = '<div class="m-bh-side">' . self::media( $ctx, $img, (string) ( $props['title'] ?? '' ), 'm-bh-side-img', 'large', true ) . '</div>';
			$media       = '';
		}

		$inner = $media . '<div class="m-container m-bh-inner">' . $copy . $split_extra . '</div>' . $hint;

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class' => 'm-bh is-' . $variant . ' is-h-' . $height . ' is-theme-' . $theme . ( ( $img || $img_m ) ? ' has-media' : '' ),
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* split-feature                                                       */
	/* ------------------------------------------------------------------ */

	public static function split_feature( array $node, array $props, string $children, RenderContext $ctx ): string {
		$side   = ( ( $props['imageSide'] ?? 'left' ) === 'right' ) ? 'right' : 'left';
		$shape  = self::opt( $props['imageShape'] ?? 'rounded', [ 'rounded', 'arch', 'square', 'circle' ], 'rounded' );
		$ratio  = self::opt( $props['ratio'] ?? 'balanced', [ 'balanced', 'image-wide', 'text-wide' ], 'balanced' );
		$theme  = self::theme( $props['theme'] ?? 'cream' );
		$align  = self::align( $props['align'] ?? 'left' );
		$track  = self::tracking( $props['tracking'] ?? 'wide', 'wide' );
		$img    = absint( $props['imageId'] ?? 0 );

		$copy = '<div class="m-sf-copy is-align-' . $align . '">';
		if ( ! empty( $props['eyebrow'] ) ) {
			$copy .= '<p class="m-eyebrow">' . esc_html( (string) $props['eyebrow'] ) . '</p>';
		}
		$copy .= self::display_title( (string) ( $props['title'] ?? '' ), self::tag( $props['titleTag'] ?? 'h2' ), 'm-sf-title m-track-' . $track, 'letters' );
		$html_text = (string) ( $props['text'] ?? '' );
		if ( '' !== trim( wp_strip_all_tags( $html_text ) ) ) {
			$copy .= '<div class="m-sf-text m-rich">' . \Meridian\Security\Sanitizer::richtext( $html_text ) . '</div>';
		}
		if ( ! empty( $props['linkText'] ) ) {
			$copy .= '<div class="m-btn-row"><a class="m-btn m-btn-primary" href="' . esc_url( (string) ( $props['linkUrl'] ?: '#' ) ) . '">' . esc_html( (string) $props['linkText'] ) . '</a></div>';
		}
		$copy .= '</div>';

		$media = '<div class="m-sf-media is-shape-' . $shape . '">' . self::media( $ctx, $img, (string) ( $props['title'] ?? '' ), 'm-sf-img' ) . '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			'<div class="m-container m-sf-grid">' . $media . $copy . '</div>',
			[ 'class' => 'm-sf is-img-' . $side . ' is-ratio-' . $ratio . ' is-theme-' . $theme ]
		);
	}

	/* ------------------------------------------------------------------ */
	/* statement-cta                                                       */
	/* ------------------------------------------------------------------ */

	public static function statement_cta( array $node, array $props, string $children, RenderContext $ctx ): string {
		$theme   = self::theme( $props['theme'] ?? 'forest', 'forest' );
		$align   = self::align( $props['align'] ?? 'center', 'center' );
		$overlay = max( 0, min( 90, absint( $props['overlay'] ?? 40 ) ) );
		$bg      = absint( $props['imageId'] ?? 0 );
		$icon    = absint( $props['iconId'] ?? 0 );
		$n_icons = max( 0, min( 6, absint( $props['iconCount'] ?? 0 ) ) );

		$icons = '';
		if ( $icon && $n_icons ) {
			$icons = '<span class="m-sc-icons" aria-hidden="true">';
			for ( $i = 0; $i < $n_icons; $i++ ) {
				$icons .= '<span class="m-sc-icon" style="--m-i:' . $i . '">' . self::media( $ctx, $icon, '', 'm-sc-icon-img', 'thumbnail' ) . '</span>';
			}
			$icons .= '</span>';
		}

		$inner = '';
		if ( $bg ) {
			$inner .= '<div class="m-sc-media" aria-hidden="true">' . self::media( $ctx, $bg, '', 'm-sc-bg', 'full' ) . '<span class="m-sc-veil" style="opacity:' . ( $overlay / 100 ) . '"></span></div>';
		}
		$body = '<div class="m-container m-sc-inner is-align-' . $align . '">';
		if ( ! empty( $props['eyebrow'] ) ) {
			$body .= '<p class="m-eyebrow">' . esc_html( (string) $props['eyebrow'] ) . '</p>';
		}
		$body .= '<div class="m-sc-headline">' . $icons . self::display_title( (string) ( $props['title'] ?? '' ), 'h2', 'm-sc-title m-track-wide', 'letters' ) . '</div>';
		if ( ! empty( $props['text'] ) ) {
			$body .= '<p class="m-sc-text">' . nl2br( esc_html( (string) $props['text'] ) ) . '</p>';
		}
		if ( ! empty( $props['buttonText'] ) ) {
			$body .= '<div class="m-btn-row"><a class="m-btn m-btn-primary" href="' . esc_url( (string) ( $props['buttonUrl'] ?: '#' ) ) . '">' . esc_html( (string) $props['buttonText'] ) . '</a></div>';
		}
		$body .= '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner . $body,
			[ 'class' => 'm-sc is-theme-' . $theme . ( $bg ? ' has-media' : '' ) ]
		);
	}

	/* ------------------------------------------------------------------ */
	/* product-rail                                                        */
	/* ------------------------------------------------------------------ */

	public static function product_rail( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		$theme  = self::theme( $props['theme'] ?? 'cream' );
		$layout = ( ( $props['layout'] ?? 'rail' ) === 'grid' ) ? 'grid' : 'rail';
		$style  = self::opt( $props['cardStyle'] ?? 'soft', [ 'soft', 'outline', 'bare' ], 'soft' );
		$arrows = ! empty( $props['arrows'] ) && 'rail' === $layout;

		if ( ! $items ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade productos a este carril.', 'meridian' ) . '</p></div>', [ 'class' => 'm-rail is-empty' ] )
				: '';
		}

		$cards = '';
		foreach ( $items as $it ) {
			$cards .= '<li class="m-rail-item">' . self::card( $ctx, $it, $style, 'portrait' ) . '</li>';
		}

		$nav = '';
		if ( $arrows ) {
			$nav = '<div class="m-rail-nav">'
				. '<button type="button" class="m-rail-btn" data-rail-prev aria-label="' . esc_attr__( 'Anterior', 'meridian' ) . '">&#8592;</button>'
				. '<button type="button" class="m-rail-btn" data-rail-next aria-label="' . esc_attr__( 'Siguiente', 'meridian' ) . '">&#8594;</button>'
				. '</div>';
		}

		$inner = '<div class="m-container">'
			. self::head( $props )
			. '<div class="m-rail-wrap">'
			. '<ul class="m-rail-track" data-rail-track>' . $cards . '</ul>'
			. $nav
			. '</div></div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'     => 'm-rail is-layout-' . $layout . ' is-theme-' . $theme,
				'style'     => self::col_vars( $props, 4, 2, 1 ) . self::section_style( $props ),
				'data-rail' => '1',
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* collection-grid                                                     */
	/* ------------------------------------------------------------------ */

	public static function collection_grid( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		$theme = self::theme( $props['theme'] ?? 'cream' );
		$style = self::opt( $props['cardStyle'] ?? 'overlay', [ 'overlay', 'stacked', 'outline' ], 'overlay' );
		$ratio = self::opt( $props['ratio'] ?? 'portrait', [ 'portrait', 'square', 'landscape' ], 'portrait' );

		$cards = '';
		foreach ( $items as $it ) {
			$cards .= '<li class="m-cg-item">' . self::card( $ctx, $it, $style, $ratio ) . '</li>';
		}
		if ( '' === $cards ) {
			if ( ! $ctx->isPreview ) {
				return '';
			}
			$cards = '<li class="m-cg-item"><p class="m-muted">' . esc_html__( 'Añade tarjetas a esta colección.', 'meridian' ) . '</p></li>';
		}

		$inner = '<div class="m-container">' . self::head( $props ) . '<ul class="m-cg-grid">' . $cards . '</ul></div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class' => 'm-cg is-theme-' . $theme,
				'style' => self::col_vars( $props, 3, 2, 1 ) . self::section_style( $props ),
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* filter-collection                                                   */
	/* ------------------------------------------------------------------ */

	public static function filter_collection( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		$theme = self::theme( $props['theme'] ?? 'cream' );
		$align = self::align( $props['align'] ?? 'center', 'center' );
		$per   = max( 2, min( 48, absint( $props['perPage'] ?? 8 ) ) );

		$cats = [];
		foreach ( $items as $it ) {
			$c = trim( (string) ( $it['category'] ?? '' ) );
			if ( '' !== $c ) {
				$cats[ sanitize_title( $c ) ] = $c;
			}
		}

		$head = '<div class="m-fc-head is-align-' . $align . '">';
		$head .= self::display_title( (string) ( $props['title'] ?? '' ), self::tag( $props['titleTag'] ?? 'h2' ), 'm-fc-title m-track-normal', 'fade' );
		if ( ! empty( $props['text'] ) ) {
			$head .= '<p class="m-fc-intro">' . nl2br( esc_html( (string) $props['text'] ) ) . '</p>';
		}
		$head .= '</div>';

		$tools = '';
		$show_filters = ! empty( $props['showFilters'] ) && $cats;
		$show_search  = ! empty( $props['showSearch'] );
		if ( $show_filters || $show_search ) {
			$tools = '<div class="m-fc-tools">';
			if ( $show_filters ) {
				$all   = trim( (string) ( $props['allLabel'] ?? '' ) ) ?: __( 'Todo', 'meridian' );
				$tools .= '<div class="m-fc-chips" role="group" aria-label="' . esc_attr__( 'Filtros', 'meridian' ) . '">';
				$tools .= '<button type="button" class="m-chip is-on" data-fc-filter="*">' . esc_html( $all ) . '</button>';
				foreach ( $cats as $slug => $label ) {
					$tools .= '<button type="button" class="m-chip" data-fc-filter="' . esc_attr( $slug ) . '">' . esc_html( $label ) . '</button>';
				}
				$tools .= '</div>';
			}
			if ( $show_search ) {
				$tools .= '<label class="m-fc-search"><span class="screen-reader-text">' . esc_html__( 'Buscar', 'meridian' ) . '</span>'
					. '<input type="search" data-fc-search placeholder="' . esc_attr__( 'Buscar…', 'meridian' ) . '"></label>';
			}
			$tools .= '</div>';
		}

		$cards = '';
		foreach ( $items as $it ) {
			$cat   = sanitize_title( (string) ( $it['category'] ?? '' ) );
			$term  = strtolower( (string) ( $it['title'] ?? '' ) . ' ' . (string) ( $it['category'] ?? '' ) . ' ' . (string) ( $it['text'] ?? '' ) );
			$cards .= '<li class="m-fc-item" data-cat="' . esc_attr( $cat ) . '" data-term="' . esc_attr( $term ) . '">'
				. self::card( $ctx, $it, 'stacked', 'landscape' ) . '</li>';
		}

		$more  = trim( (string) ( $props['moreLabel'] ?? '' ) ) ?: __( 'Cargar más', 'meridian' );
		$empty = trim( (string) ( $props['emptyLabel'] ?? '' ) ) ?: __( 'No hay resultados.', 'meridian' );

		$inner = '<div class="m-container">' . $head . $tools
			. '<ul class="m-fc-grid" data-fc-grid>' . $cards . '</ul>'
			. '<p class="m-fc-empty" data-fc-empty hidden>' . esc_html( $empty ) . '</p>'
			. '<div class="m-fc-more"><button type="button" class="m-btn m-btn-outline" data-fc-more>' . esc_html( $more ) . '</button></div>'
			. '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'        => 'm-fc is-theme-' . $theme,
				'style'        => self::col_vars( $props, 4, 2, 1 ) . self::section_style( $props ),
				'data-filter-collection' => '1',
				'data-per-page' => $per,
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* review-slider                                                       */
	/* ------------------------------------------------------------------ */

	public static function review_slider( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values(
			array_filter( $items, static fn( $i ) => is_array( $i ) && '' !== trim( (string) ( $i['text'] ?? '' ) ) )
		);
		if ( ! $items ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade reseñas.', 'meridian' ) . '</p></div>', [ 'class' => 'm-rev is-empty' ] )
				: '';
		}

		$theme    = self::theme( $props['theme'] ?? 'surface', 'surface' );
		$per      = max( 1, min( 3, absint( $props['perView'] ?? 2 ) ) );
		$autoplay = ! empty( $props['autoplay'] );
		$interval = max( 2000, min( 20000, absint( $props['interval'] ?? 6000 ) ) );

		$slides = '';
		$dots   = '';
		foreach ( $items as $i => $it ) {
			$rating = max( 0, min( 5, absint( $it['rating'] ?? 0 ) ) );
			$stars  = '';
			if ( $rating > 0 ) {
				$stars = '<span class="m-rev-stars" aria-label="' . esc_attr( sprintf( /* translators: %d stars */ __( '%d de 5 estrellas', 'meridian' ), $rating ) ) . '">'
					. str_repeat( '<span aria-hidden="true">&#9733;</span>', $rating ) . '</span>';
			}
			$meta = '';
			$author = trim( (string) ( $it['author'] ?? '' ) );
			$source = trim( (string) ( $it['source'] ?? '' ) );
			if ( '' !== $author || '' !== $source ) {
				$meta = '<footer class="m-rev-meta">' . esc_html( trim( $author . ( '' !== $author && '' !== $source ? ', ' : '' ) . $source ) ) . '</footer>';
			}
			$slides .= '<li class="m-rev-slide" role="group" aria-roledescription="slide">'
				. '<blockquote class="m-rev-card">' . $stars . '<p class="m-rev-text">' . esc_html( (string) $it['text'] ) . '</p>' . $meta . '</blockquote></li>';
			$dots   .= '<button type="button" class="m-rev-dot' . ( 0 === $i ? ' is-on' : '' ) . '" data-rev-dot="' . $i . '" aria-label="' . esc_attr( sprintf( /* translators: %d index */ __( 'Reseña %d', 'meridian' ), $i + 1 ) ) . '"></button>';
		}

		$inner = '<div class="m-container">'
			. self::head( $props )
			. '<div class="m-rev-wrap">'
			. '<button type="button" class="m-rev-arrow is-prev" data-rev-prev aria-label="' . esc_attr__( 'Anterior', 'meridian' ) . '">&#8592;</button>'
			. '<div class="m-rev-viewport"><ul class="m-rev-track" data-rev-track>' . $slides . '</ul></div>'
			. '<button type="button" class="m-rev-arrow is-next" data-rev-next aria-label="' . esc_attr__( 'Siguiente', 'meridian' ) . '">&#8594;</button>'
			. '</div>'
			. '<div class="m-rev-dots">' . $dots . '</div>'
			. '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'          => 'm-rev is-theme-' . $theme,
				'style'          => '--m-rev-per:' . $per . ';' . self::section_style( $props ),
				'data-review-slider' => '1',
				'data-autoplay'  => $autoplay ? $interval : '0',
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* numbered-list                                                       */
	/* ------------------------------------------------------------------ */

	public static function numbered_list( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		if ( ! $items ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade elementos a la lista.', 'meridian' ) . '</p></div>', [ 'class' => 'm-nl is-empty' ] )
				: '';
		}

		$variant = self::opt( $props['variant'] ?? 'stack', [ 'stack', 'accordion', 'grid' ], 'stack' );
		$theme   = self::theme( $props['theme'] ?? 'cream' );
		$numfmt  = self::opt( $props['numberStyle'] ?? 'pad', [ 'pad', 'plain', 'none' ], 'pad' );
		$start   = max( 0, min( 99, absint( $props['startAt'] ?? 1 ) ) );
		$open1   = ! empty( $props['openFirst'] );
		$uid     = sanitize_html_class( (string) ( $node['id'] ?? 'nl' ) );

		$rows = '';
		foreach ( $items as $i => $it ) {
			$n     = $start + $i;
			$num   = 'none' === $numfmt ? '' : ( 'pad' === $numfmt ? str_pad( (string) $n, 2, '0', STR_PAD_LEFT ) : (string) $n );
			$title = trim( (string) ( $it['title'] ?? '' ) );
			$text  = trim( (string) ( $it['text'] ?? '' ) );
			$img   = absint( $it['imageId'] ?? 0 );
			$alt   = (string) ( $it['alt'] ?? $title );

			$num_html = '' !== $num ? '<span class="m-nl-num" aria-hidden="true">' . esc_html( $num ) . '</span>' : '';
			$fig      = $img ? '<div class="m-nl-media">' . self::media( $ctx, $img, $alt, 'm-nl-img' ) . '</div>' : '';
			$body     = ( '' !== $text ? '<p class="m-nl-text">' . nl2br( esc_html( $text ) ) . '</p>' : '' ) . $fig;

			if ( 'accordion' === $variant ) {
				$open   = ( $open1 && 0 === $i ) ? ' open' : '';
				$rows  .= '<li class="m-nl-row"><details class="m-nl-acc" name="' . esc_attr( 'acc-' . $uid ) . '"' . $open . '>'
					. '<summary class="m-nl-summary">' . $num_html . '<span class="m-nl-title">' . esc_html( $title ) . '</span>'
					. '<span class="m-nl-chev" aria-hidden="true"></span></summary>'
					. '<div class="m-nl-body">' . $body . '</div></details></li>';
			} else {
				$rows .= '<li class="m-nl-row"><div class="m-nl-head">' . $num_html . '<h3 class="m-nl-title">' . esc_html( $title ) . '</h3></div>'
					. '<div class="m-nl-body">' . $body . '</div></li>';
			}
		}

		$inner = '<div class="m-container">' . self::head( $props ) . '<ul class="m-nl-list">' . $rows . '</ul></div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class' => 'm-nl is-' . $variant . ' is-theme-' . $theme,
				'style' => self::col_vars( $props, 2, 1, 1 ) . self::section_style( $props ),
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* statement-list                                                      */
	/* ------------------------------------------------------------------ */

	public static function statement_list( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		if ( ! $items ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade hitos.', 'meridian' ) . '</p></div>', [ 'class' => 'm-sl is-empty' ] )
				: '';
		}
		$theme = self::theme( $props['theme'] ?? 'cream' );

		$rows = '';
		foreach ( $items as $it ) {
			$label = trim( (string) ( $it['label'] ?? '' ) );
			$title = trim( (string) ( $it['title'] ?? '' ) );
			$url   = (string) ( $it['url'] ?? '' );
			$body  = ( '' !== $label ? '<span class="m-sl-label">' . esc_html( $label ) . '</span>' : '' )
				. '<span class="m-sl-title">' . esc_html( $title ) . '</span>';
			$rows .= '<li class="m-sl-row">' . ( '' !== $url
				? '<a class="m-sl-link" href="' . esc_url( $url ) . '">' . $body . '</a>'
				: $body ) . '</li>';
		}

		$inner = '<div class="m-container">' . self::head( $props ) . '<ul class="m-sl-list">' . $rows . '</ul></div>';

		return ComponentRenders::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-sl is-theme-' . $theme, 'style' => self::section_style( $props ) ] );
	}

	/* ------------------------------------------------------------------ */
	/* scroll-text                                                         */
	/* ------------------------------------------------------------------ */

	public static function scroll_text( array $node, array $props, string $children, RenderContext $ctx ): string {
		$text = trim( (string) ( $props['text'] ?? '' ) );
		if ( '' === $text ) {
			return '';
		}
		$size  = self::opt( $props['size'] ?? 'lg', [ 'md', 'lg', 'xl' ], 'lg' );
		$align = self::align( $props['align'] ?? 'center', 'center' );
		$theme = self::theme( $props['theme'] ?? 'cream' );
		$max   = max( 320, min( 1600, absint( $props['maxWidth'] ?? 900 ) ) );

		$words = preg_split( '/\s+/u', $text ) ?: [];
		$out   = '';
		foreach ( $words as $i => $w ) {
			$out .= '<span class="m-st-w" style="--m-w:' . (int) $i . '" aria-hidden="true">' . esc_html( $w ) . '</span> ';
		}

		$inner = '<div class="m-container"><p class="m-st-text is-align-' . $align . '" data-scroll-text>'
			. '<span class="screen-reader-text">' . esc_html( $text ) . '</span>' . $out . '</p></div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class' => 'm-st is-size-' . $size . ' is-theme-' . $theme,
				'style' => '--m-st-max:' . $max . 'px;--m-st-count:' . count( $words ) . ';',
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* trace-module                                                        */
	/* ------------------------------------------------------------------ */

	public static function trace_module( array $node, array $props, string $children, RenderContext $ctx ): string {
		$theme = self::theme( $props['theme'] ?? 'forest', 'forest' );
		$align = self::align( $props['align'] ?? 'center', 'center' );
		$bg    = absint( $props['imageId'] ?? 0 );
		$steps = is_array( $props['steps'] ?? null ) ? $props['steps'] : [];
		$steps = array_values( array_filter( $steps, 'is_array' ) );
		$code  = strtoupper( trim( (string) ( $props['demoCode'] ?? '' ) ) );
		$uid   = sanitize_html_class( (string) ( $node['id'] ?? 'tr' ) );

		$list = '';
		foreach ( $steps as $i => $st ) {
			$title = trim( (string) ( $st['title'] ?? '' ) );
			$text  = trim( (string) ( $st['text'] ?? '' ) );
			$meta  = trim( (string) ( $st['meta'] ?? '' ) );
			$img   = absint( $st['imageId'] ?? 0 );
			$alt   = (string) ( $st['alt'] ?? $title );
			$list .= '<li class="m-tr-step" style="--m-i:' . (int) $i . '">'
				. '<span class="m-tr-dot" aria-hidden="true">' . str_pad( (string) ( $i + 1 ), 2, '0', STR_PAD_LEFT ) . '</span>'
				. ( $img ? '<span class="m-tr-media">' . self::media( $ctx, $img, $alt, 'm-tr-img' ) . '</span>' : '' )
				. '<span class="m-tr-body">'
				. '<span class="m-tr-title">' . esc_html( $title ) . '</span>'
				. ( '' !== $meta ? '<span class="m-tr-meta">' . esc_html( $meta ) . '</span>' : '' )
				. ( '' !== $text ? '<span class="m-tr-text">' . esc_html( $text ) . '</span>' : '' )
				. '</span></li>';
		}

		$head = '';
		if ( ! empty( $props['eyebrow'] ) ) {
			$head .= '<p class="m-eyebrow">' . esc_html( (string) $props['eyebrow'] ) . '</p>';
		}
		$head .= self::display_title( (string) ( $props['title'] ?? '' ), self::tag( $props['titleTag'] ?? 'h2' ), 'm-tr-heading m-track-wide', 'letters' );
		if ( ! empty( $props['text'] ) ) {
			$head .= '<p class="m-tr-intro">' . nl2br( esc_html( (string) $props['text'] ) ) . '</p>';
		}

		$ph   = trim( (string) ( $props['placeholder'] ?? '' ) ) ?: __( 'Código', 'meridian' );
		$btn  = trim( (string) ( $props['buttonText'] ?? '' ) ) ?: __( 'Consultar', 'meridian' );
		$help = trim( (string) ( $props['helpText'] ?? '' ) );
		$err  = trim( (string) ( $props['errorText'] ?? '' ) ) ?: __( 'No encontramos ese código.', 'meridian' );

		$form = '<form class="m-tr-form" data-trace-form novalidate>'
			. '<label class="m-tr-field" for="' . esc_attr( 'tr-' . $uid ) . '"><span class="screen-reader-text">' . esc_html( $ph ) . '</span>'
			. '<input id="' . esc_attr( 'tr-' . $uid ) . '" type="text" data-trace-input placeholder="' . esc_attr( $ph ) . '" autocomplete="off" inputmode="text"></label>'
			. '<button type="submit" class="m-btn m-btn-primary">' . esc_html( $btn ) . '</button>'
			. '</form>';
		if ( '' !== $help ) {
			$form .= '<p class="m-tr-help">' . esc_html( $help ) . '</p>';
		}
		$form .= '<p class="m-tr-error" data-trace-error hidden>' . esc_html( $err ) . '</p>';

		$inner = '';
		if ( $bg ) {
			$inner .= '<div class="m-tr-media-bg" aria-hidden="true">' . self::media( $ctx, $bg, '', 'm-tr-bg', 'full' ) . '</div>';
		}
		$inner .= '<div class="m-container m-tr-inner is-align-' . $align . '">'
			. '<div class="m-tr-head">' . $head . $form . '</div>'
			. '<ol class="m-tr-steps" data-trace-steps>' . $list . '</ol>'
			. '</div>';

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			$inner,
			[
				'class'       => 'm-tr is-theme-' . $theme . ( $bg ? ' has-media' : '' ),
				'data-trace'  => '1',
				'data-code'   => $code,
			]
		);
	}

	/* ------------------------------------------------------------------ */
	/* retail-strip                                                        */
	/* ------------------------------------------------------------------ */

	public static function retail_strip( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values( array_filter( $items, 'is_array' ) );
		$theme = self::theme( $props['theme'] ?? 'cream' );
		$track = self::tracking( $props['tracking'] ?? 'wide', 'wide' );
		$gray  = ! empty( $props['grayscale'] );

		$logos = '';
		foreach ( $items as $it ) {
			$img  = absint( $it['imageId'] ?? 0 );
			$name = trim( (string) ( $it['title'] ?? '' ) );
			$alt  = (string) ( $it['alt'] ?? $name );
			$url  = (string) ( $it['url'] ?? '' );
			if ( ! $img && '' === $name ) {
				continue;
			}
			$body  = $img ? self::media( $ctx, $img, $alt, 'm-rs-img', 'medium' ) : '<span class="m-rs-name">' . esc_html( $name ) . '</span>';
			$logos .= '<li class="m-rs-item">' . ( '' !== $url
				? '<a href="' . esc_url( $url ) . '" rel="noopener">' . $body . '</a>'
				: $body ) . '</li>';
		}

		$inner = '<div class="m-container m-rs-inner">'
			. self::display_title( (string) ( $props['title'] ?? '' ), self::tag( $props['titleTag'] ?? 'h2' ), 'm-rs-title m-track-' . $track, 'letters' )
			. ( '' !== $logos ? '<ul class="m-rs-list' . ( $gray ? ' is-gray' : '' ) . '">' . $logos . '</ul>' : '' )
			. '</div>';

		return ComponentRenders::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-rs is-theme-' . $theme ] );
	}

	/* ------------------------------------------------------------------ */
	/* info-table                                                          */
	/* ------------------------------------------------------------------ */

	public static function info_table( array $node, array $props, string $children, RenderContext $ctx ): string {
		$rows = is_array( $props['rows'] ?? null ) ? $props['rows'] : [];
		$rows = array_values( array_filter( $rows, 'is_array' ) );
		if ( ! $rows ) {
			return $ctx->isPreview
				? ComponentRenders::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Añade filas a la tabla.', 'meridian' ) . '</p>', [ 'class' => 'm-it is-empty' ] )
				: '';
		}
		$theme = self::theme( $props['theme'] ?? 'surface', 'surface' );

		$body = '';
		foreach ( $rows as $r ) {
			$body .= '<tr><th scope="row">' . esc_html( (string) ( $r['a'] ?? '' ) ) . '</th><td>' . esc_html( (string) ( $r['b'] ?? '' ) ) . '</td></tr>';
		}

		$title   = trim( (string) ( $props['title'] ?? '' ) );
		$caption = trim( (string) ( $props['caption'] ?? '' ) );

		$inner = ( '' !== $title ? '<h3 class="m-it-title">' . esc_html( $title ) . '</h3>' : '' )
			. '<div class="m-it-scroll"><table class="m-it-table"><thead><tr>'
			. '<th scope="col">' . esc_html( (string) ( $props['headA'] ?? '' ) ) . '</th>'
			. '<th scope="col">' . esc_html( (string) ( $props['headB'] ?? '' ) ) . '</th>'
			. '</tr></thead><tbody>' . $body . '</tbody></table></div>'
			. ( '' !== $caption ? '<p class="m-it-caption">' . esc_html( $caption ) . '</p>' : '' );

		return ComponentRenders::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-it is-theme-' . $theme ] );
	}
}
