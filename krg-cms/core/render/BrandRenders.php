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

	/**
	 * Declara qué color necesita la cabecera cuando pasa sobre este bloque.
	 * Lo consume la cabecera adaptativa (assets/js/modules.js).
	 */
	private static function skin( string $theme ): array {
		return [ 'data-header-skin' => \Meridian\Design\Contrast::for_theme( $theme ) ];
	}

	/**
	 * Variables propias del bloque: espacio y colores.
	 *
	 * Se emiten sobre el mismo elemento que lleva la clase del tema, que
	 * es quien declara `--m-th-bg` y `--m-th-fg`. Escribirlas aqui, en
	 * linea, las pisa sin tocar la hoja de estilos y sin `!important`:
	 * el tema sigue mandando mientras el campo este en blanco.
	 *
	 * Un campo en blanco no escribe nada, y por eso un 0 escrito a mano
	 * si significa cero.
	 */
	private static function section_style( array $p ): string {
		return self::theme_style( $p );
	}

	/** Fondo y texto propios del bloque, por encima del tema. */
	private static function theme_style( array $p ): string {
		$style = '';
		$bg    = self::color_value( $p['bgColor'] ?? null );
		$fg    = self::color_value( $p['textColor'] ?? null );
		if ( '' !== $bg ) {
			$style .= '--m-th-bg:' . $bg . ';';
		}
		if ( '' !== $fg ) {
			$style .= '--m-th-fg:' . $fg . ';';
		}
		return $style;
	}

	/** Igual que `section_style()`, pero listo para un atributo style. */
	private static function style_attr( array $p, string $extra = '' ): array {
		$style = $extra . self::section_style( $p );
		return '' === $style ? [] : [ 'style' => $style ];
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
			return $ctx->isCanvas
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
			array_merge(
				array_merge(
					[
						'class' => 'm-bh is-' . $variant . ' is-h-' . $height . ' is-theme-' . $theme . ( ( $img || $img_m ) ? ' has-media' : '' ),
					],
					self::style_attr( $props )
				),
				// Con imagen de fondo el velo oscurece: la cabecera va en claro.
				( $img || $img_m ) ? [ 'data-header-skin' => 'light' ] : self::skin( $theme )
			)
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
			array_merge(
				array_merge(
					[ 'class' => 'm-sf is-img-' . $side . ' is-ratio-' . $ratio . ' is-theme-' . $theme ],
					self::style_attr( $props )
				),
				self::skin( $theme )
			)
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
			array_merge(
				array_merge(
					[ 'class' => 'm-sc is-theme-' . $theme . ( $bg ? ' has-media' : '' ) ],
					self::style_attr( $props )
				),
				$bg ? [ 'data-header-skin' => 'light' ] : self::skin( $theme )
			)
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
			return $ctx->isCanvas
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
			if ( ! $ctx->isCanvas ) {
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
			return $ctx->isCanvas
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade reseñas.', 'meridian' ) . '</p></div>', [ 'class' => 'm-rev is-empty' ] )
				: '';
		}

		$theme    = self::theme( $props['theme'] ?? 'surface', 'surface' );
		$per      = max( 1, min( 3, absint( $props['perView'] ?? 2 ) ) );
		// Mayúsculas: desactivadas por defecto. El texto se respeta tal cual se
		// escribe; quien quiera versales lo activa aquí.
		$upper    = ! empty( $props['uppercase'] );
		// Recorte de las reseñas largas. 0 = sin recorte.
		$clamp    = max( 0, min( 20, absint( $props['clampLines'] ?? 6 ) ) );
		$more     = trim( (string) ( $props['moreText'] ?? '' ) );
		if ( '' === $more ) {
			$more = __( 'Leer completa', 'meridian' );
		}
		$autoplay = ! empty( $props['autoplay'] );
		$interval = max( 2000, min( 20000, absint( $props['interval'] ?? 6000 ) ) );
		$card_c   = self::color_value( $props['cardColor'] ?? null );
		$card     = '' !== $card_c ? '--m-rev-card-bg:' . $card_c . ';' : '';

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
			$text_attr = $clamp ? ' style="--m-rev-clamp:' . $clamp . '"' : '';
			// El botón nace oculto: solo lo muestra el JS en las reseñas que de
			// verdad se cortan, así no aparece en las cortas.
			$more_btn  = $clamp
				? '<button type="button" class="m-rev-more" data-rev-more hidden>' . esc_html( $more ) . '</button>'
				: '';
			$slides .= '<li class="m-rev-slide" role="group" aria-roledescription="slide">'
				. '<blockquote class="m-rev-card">' . $stars
				. '<p class="m-rev-text"' . $text_attr . '>' . esc_html( (string) $it['text'] ) . '</p>'
				. $more_btn . $meta . '</blockquote></li>';
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
				'class'          => 'm-rev is-theme-' . $theme . ( $upper ? ' is-upper' : '' ),
				// El color de las tarjetas va aparte del fondo del bloque:
				// la tarjeta pinta el suyo encima, asi que cambiar solo el
				// del bloque dejaba las tarjetas igual.
				'style'          => '--m-rev-per:' . $per . ';' . $card . self::section_style( $props ),
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
			return $ctx->isCanvas
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
			return $ctx->isCanvas
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
				'style' => '--m-st-max:' . $max . 'px;--m-st-count:' . count( $words ) . ';' . self::section_style( $props ),
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
			array_merge(
				array_merge(
					[
						'class'      => 'm-tr is-theme-' . $theme . ( $bg ? ' has-media' : '' ),
						'data-trace' => '1',
						'data-code'  => $code,
					],
					self::style_attr( $props )
				),
				$bg ? [ 'data-header-skin' => 'light' ] : self::skin( $theme )
			)
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

		return ComponentRenders::wrap( $node, $ctx, 'div', $inner, array_merge( [ 'class' => 'm-rs is-theme-' . $theme ], self::style_attr( $props ) ) );
	}

	/* ------------------------------------------------------------------ */
	/* info-table                                                          */
	/* ------------------------------------------------------------------ */

	public static function info_table( array $node, array $props, string $children, RenderContext $ctx ): string {
		$rows = is_array( $props['rows'] ?? null ) ? $props['rows'] : [];
		$rows = array_values( array_filter( $rows, 'is_array' ) );
		if ( ! $rows ) {
			return $ctx->isCanvas
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

		return ComponentRenders::wrap( $node, $ctx, 'div', $inner, array_merge( [ 'class' => 'm-it is-theme-' . $theme ], self::style_attr( $props ) ) );
	}

	/* ------------------------------------------------------------------ */
	/* split-panel                                                         */
	/* ------------------------------------------------------------------ */

	public static function split_panel( array $node, array $props, string $children, RenderContext $ctx ): string {
		$side   = ( ( $props['mediaSide'] ?? 'right' ) === 'left' ) ? 'left' : 'right';
		$ratio  = self::opt( $props['ratio'] ?? 'half', [ 'half', 'media-wide', 'copy-wide' ], 'half' );
		$height = self::opt( $props['height'] ?? 'screen', [ 'screen', 'tall', 'medium', 'auto', 'custom' ], 'screen' );
		// Altura a medida: en píxeles o en porcentaje de la pantalla.
		$h_style = '';
		if ( 'custom' === $height ) {
			$h_unit  = ( ( $props['heightUnit'] ?? 'vh' ) === 'px' ) ? 'px' : 'svh';
			$h_max   = 'px' === $h_unit ? 4000 : 400;
			$h_val   = max( 1, min( $h_max, absint( $props['heightValue'] ?? 70 ) ) );
			$h_style = '--m-sp-h:' . $h_val . $h_unit;
		}
		$fit    = ( ( $props['mediaFit'] ?? 'cover' ) === 'contain' ) ? 'contain' : 'cover';
		$theme  = self::theme( $props['theme'] ?? 'cream' );
		$mtheme = self::theme( $props['mediaTheme'] ?? 'surface', 'surface' );
		$align  = self::align( $props['align'] ?? 'center', 'center' );
		$track  = self::tracking( $props['tracking'] ?? 'normal' );
		$reveal = self::opt( $props['reveal'] ?? 'fade', [ 'fade', 'letters', 'none' ], 'fade' );
		$bstyle = self::opt( $props['buttonStyle'] ?? 'solid', [ 'solid', 'outline', 'ghost' ], 'solid' );
		$bpos   = self::opt( $props['badgePos'] ?? 'title', [ 'title', 'top', 'corner' ], 'title' );
		$badge  = absint( $props['badgeId'] ?? 0 );
		$uid    = sanitize_html_class( (string) ( $node['id'] ?? 'sp' ) );

		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values(
			array_filter( $items, static fn( $i ) => is_array( $i ) && absint( $i['imageId'] ?? 0 ) )
		);

		// --- panel de contenido ---
		$badge_html = $badge
			? '<span class="m-sp-badge is-' . $bpos . '">' . self::media( $ctx, $badge, '', 'm-sp-badge-img', 'thumbnail' ) . '</span>'
			: '';

		$copy = '';
		if ( 'top' === $bpos && '' !== $badge_html ) {
			$copy .= $badge_html;
		}
		if ( ! empty( $props['eyebrow'] ) ) {
			$copy .= '<p class="m-eyebrow">' . esc_html( (string) $props['eyebrow'] ) . '</p>';
		}
		$title_html = self::display_title(
			(string) ( $props['title'] ?? '' ),
			self::tag( $props['titleTag'] ?? 'h2' ),
			'm-sp-title m-track-' . $track,
			$reveal
		);
		if ( 'title' === $bpos && '' !== $badge_html && '' !== $title_html ) {
			// El sello se superpone sobre el titular, como en la referencia.
			$title_html = '<span class="m-sp-title-wrap">' . $badge_html . $title_html . '</span>';
		}
		$copy .= $title_html;
		if ( ! empty( $props['subtitle'] ) ) {
			$copy .= '<p class="m-sp-sub m-track-wide">' . nl2br( esc_html( (string) $props['subtitle'] ) ) . '</p>';
		}
		$rich = (string) ( $props['text'] ?? '' );
		if ( '' !== trim( wp_strip_all_tags( $rich ) ) ) {
			$copy .= '<div class="m-sp-text m-rich">' . \Meridian\Security\Sanitizer::richtext( $rich ) . '</div>';
		}
		if ( ! empty( $props['buttonText'] ) ) {
			$arrow = ! empty( $props['buttonArrow'] )
				? '<span class="m-btn-arrow" aria-hidden="true">&#8594;</span>'
				: '';
			$map   = [ 'solid' => 'm-btn-primary', 'outline' => 'm-btn-outline', 'ghost' => 'm-btn-ghost' ];
			$copy .= '<div class="m-btn-row"><a class="m-btn ' . $map[ $bstyle ] . ' m-sp-btn" href="'
				. esc_url( (string) ( $props['buttonUrl'] ?: '#' ) ) . '">'
				. esc_html( (string) $props['buttonText'] ) . $arrow . '</a></div>';
		}

		$panel_style = self::theme_style( $props );
		$copy_panel  = '<div class="m-sp-copy is-theme-' . $theme . ' is-align-' . $align . '"'
			. ( '' !== $panel_style ? ' style="' . esc_attr( $panel_style ) . '"' : '' ) . '>'
			. '<div class="m-sp-copy-inner">' . $copy . '</div>'
			. ( 'corner' === $bpos ? $badge_html : '' )
			. '</div>';

		// --- panel de imagen (carrusel si hay más de una) ---
		$media_panel = '';
		if ( $items ) {
			$multi  = count( $items ) > 1;
			$slides = '';
			$dots   = '';
			foreach ( $items as $i => $it ) {
				$cap     = trim( (string) ( $it['caption'] ?? '' ) );
				$slides .= '<li class="m-sp-slide">'
					. self::media( $ctx, absint( $it['imageId'] ), (string) ( $it['alt'] ?? '' ), 'm-sp-img', 'large', 0 === $i )
					. ( '' !== $cap ? '<span class="m-sp-cap">' . esc_html( $cap ) . '</span>' : '' )
					. '</li>';
				$dots   .= '<button type="button" class="m-sp-dot' . ( 0 === $i ? ' is-on' : '' ) . '" data-sp-dot="' . $i . '" aria-label="'
					. esc_attr( sprintf( /* translators: %d index */ __( 'Imagen %d', 'meridian' ), $i + 1 ) ) . '"></button>';
			}
			$nav = '';
			if ( $multi && ! empty( $props['arrows'] ) ) {
				$nav .= '<button type="button" class="m-sp-arrow is-prev" data-sp-prev aria-label="' . esc_attr__( 'Anterior', 'meridian' ) . '">&#8592;</button>'
					. '<button type="button" class="m-sp-arrow is-next" data-sp-next aria-label="' . esc_attr__( 'Siguiente', 'meridian' ) . '">&#8594;</button>';
			}
			$dots_html = ( $multi && ! empty( $props['dots'] ) ) ? '<div class="m-sp-dots">' . $dots . '</div>' : '';
			$auto      = ( $multi && ! empty( $props['autoplay'] ) )
				? max( 2000, min( 20000, absint( $props['interval'] ?? 6000 ) ) )
				: 0;

			$media_panel = '<div class="m-sp-media is-theme-' . $mtheme . ' is-fit-' . $fit . '"'
				. ( $multi ? ' data-sp-carousel="1" data-autoplay="' . $auto . '"' : '' )
				. ' id="' . esc_attr( 'sp-' . $uid ) . '">'
				. '<ul class="m-sp-track" data-sp-track>' . $slides . '</ul>'
				. $nav . $dots_html
				. '</div>';
		} elseif ( $ctx->isCanvas ) {
			$media_panel = '<div class="m-sp-media is-theme-' . $mtheme . ' is-empty"><p class="m-muted">'
				. esc_html__( 'Añade una o varias imágenes.', 'meridian' ) . '</p></div>';
		}

		$inner = ( 'left' === $side )
			? $media_panel . $copy_panel
			: $copy_panel . $media_panel;

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			'<div class="m-sp-grid">' . $inner . '</div>',
			array_merge(
				[
					'class' => 'm-sp is-media-' . $side . ' is-ratio-' . $ratio . ' is-h-' . $height
						. ( $media_panel ? '' : ' is-single' ),
					'style' => trim( (string) $h_style, ';' ),
				],
				self::skin( $theme )
			)
		);
	}

	/* ------------------------------------------------------------------ */
	/* wordmark                                                            */
	/* ------------------------------------------------------------------ */

	public static function wordmark( array $node, array $props, string $children, RenderContext $ctx ): string {
		$text = trim( (string) ( $props['text'] ?? '' ) );
		if ( '' === $text ) {
			return $ctx->isCanvas
				? ComponentRenders::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Escribe el texto del logotipo.', 'meridian' ) . '</p>', [ 'class' => 'm-wm is-empty' ] )
				: '';
		}

		$tag    = self::tag( $props['tag'] ?? 'p', 'p' );
		$fit    = ( ( $props['fit'] ?? 'fill' ) === 'contain' ) ? 'contain' : 'fill';
		$size   = self::opt( $props['size'] ?? 'display', [ 'display', 'xl', 'lg' ], 'display' );
		$track  = self::tracking( $props['tracking'] ?? 'normal' );
		$align  = self::align( $props['align'] ?? 'center', 'center' );
		$shadow = self::opt( $props['shadow'] ?? 'offset', [ 'offset', 'outline', 'none' ], 'offset' );
		$theme  = self::theme( $props['theme'] ?? 'cream' );
		$reveal = self::opt( $props['reveal'] ?? 'fade', [ 'fade', 'letters', 'none' ], 'fade' );

		$style = '--m-wm-x:' . (int) max( -24, min( 24, (int) ( $props['shadowX'] ?? 6 ) ) ) . 'px;'
			. '--m-wm-y:' . (int) max( -24, min( 24, (int) ( $props['shadowY'] ?? 6 ) ) ) . 'px;';
		$sc = self::color_value( $props['shadowColor'] ?? null );
		if ( '' !== $sc ) {
			$style .= '--m-wm-shadow:' . $sc . ';';
		}
		$tc = self::color_value( $props['textColor'] ?? null );
		if ( '' !== $tc ) {
			$style .= '--m-wm-color:' . $tc . ';';
		}
		// `fill` escala el texto al ancho disponible con una unidad relativa al viewport.
		if ( 'fill' === $fit ) {
			$len    = max( 1, function_exists( 'mb_strlen' ) ? mb_strlen( $text ) : strlen( $text ) );
			$style .= '--m-wm-len:' . $len . ';';
		}

		$inner = self::display_title( $text, $tag, 'm-wm-text m-track-' . $track, $reveal );
		if ( ! empty( $props['url'] ) ) {
			$inner = '<a class="m-wm-link" href="' . esc_url( (string) $props['url'] ) . '">' . $inner . '</a>';
		}

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			'<div class="m-container m-wm-inner">' . $inner . '</div>',
			array_merge(
				[
					'class' => 'm-wm is-fit-' . $fit . ' is-size-' . $size . ' is-align-' . $align
						. ' is-shadow-' . $shadow . ' is-theme-' . $theme,
					'style' => $style . self::section_style( $props ),
				],
				self::skin( $theme )
			)
		);
	}

	/** Resuelve un campo `color` del esquema a un valor CSS usable. */
	/**
	 * Valor CSS de un campo de color: hexadecimal o variable del sistema.
	 *
	 * Devuelve cadena vacia cuando no hay color elegido («sin color»),
	 * que es lo que deja mandar al tema.
	 */
	private static function color_value( $c ): string {
		if ( ! is_array( $c ) || 'none' === ( $c['mode'] ?? '' ) ) {
			return '';
		}
		if ( ( $c['mode'] ?? '' ) === 'token' && ! empty( $c['token'] ) ) {
			return \Meridian\Design\TokenCompiler::token_var( (string) $c['token'] );
		}
		if ( ! empty( $c['value'] ) ) {
			return \Meridian\Security\Sanitizer::css_color( (string) $c['value'] );
		}
		return '';
	}

	/* ------------------------------------------------------------------ */
	/* menu-list (carta de restaurante)                                    */
	/* ------------------------------------------------------------------ */

	/**
	 * Lista de categorias de la carta, en el orden declarado.
	 *
	 * Primero las que el usuario ha definido (ese es el orden de las
	 * pestanas) y despues las que aparezcan escritas en un plato pero no
	 * esten en la lista: asi escribir una categoria nueva en un plato no
	 * lo hace desaparecer de la carta.
	 *
	 * @return array<string, array{label:string,text:string}>
	 */
	private static function menu_categories( array $declared, array $items ): array {
		$out = [];
		foreach ( $declared as $c ) {
			if ( ! is_array( $c ) ) {
				continue;
			}
			$label = trim( (string) ( $c['label'] ?? '' ) );
			if ( '' === $label ) {
				continue;
			}
			$slug = sanitize_title( $label );
			if ( '' === $slug || isset( $out[ $slug ] ) ) {
				continue;
			}
			$out[ $slug ] = [
				'label' => $label,
				'text'  => trim( (string) ( $c['text'] ?? '' ) ),
			];
		}
		foreach ( $items as $it ) {
			$label = trim( (string) ( $it['category'] ?? '' ) );
			if ( '' === $label ) {
				continue;
			}
			$slug = sanitize_title( $label );
			if ( '' === $slug || isset( $out[ $slug ] ) ) {
				continue;
			}
			$out[ $slug ] = [
				'label' => $label,
				'text'  => '',
			];
		}
		return $out;
	}

	/** Un plato de la carta. */
	private static function menu_item( RenderContext $ctx, array $it, bool $images, string $shape ): string {
		$title = trim( (string) ( $it['title'] ?? '' ) );
		$text  = trim( (string) ( $it['text'] ?? '' ) );
		$price = trim( (string) ( $it['price'] ?? '' ) );
		$badge = trim( (string) ( $it['badge'] ?? '' ) );
		$url   = (string) ( $it['url'] ?? '' );
		$img   = absint( $it['imageId'] ?? 0 );
		$alt   = (string) ( $it['alt'] ?? $title );
		$cat   = trim( (string) ( $it['category'] ?? '' ) );

		$media = '';
		if ( $images && $img ) {
			$media = '<span class="m-carta-media is-' . esc_attr( $shape ) . '">'
				. self::media( $ctx, $img, $alt, 'm-carta-img', 'medium' )
				. '</span>';
		}

		$head = '<span class="m-carta-row">'
			. '<span class="m-carta-name">' . esc_html( $title ) . '</span>'
			. ( '' !== $price ? '<span class="m-carta-price">' . esc_html( $price ) . '</span>' : '' )
			. '</span>';

		$body = $head;
		if ( '' !== $badge ) {
			$body .= '<span class="m-carta-badge">' . esc_html( $badge ) . '</span>';
		}
		if ( '' !== $text ) {
			$body .= '<span class="m-carta-desc">' . nl2br( esc_html( $text ) ) . '</span>';
		}

		$inner = $media . '<span class="m-carta-body">' . $body . '</span>';
		if ( '' !== $url ) {
			$inner = '<a class="m-carta-link" href="' . esc_url( $url ) . '">' . $inner . '</a>';
		}

		return '<li class="m-carta-item" data-cat="' . esc_attr( '' !== $cat ? sanitize_title( $cat ) : '' ) . '">' . $inner . '</li>';
	}

	public static function menu_list( array $node, array $props, string $children, RenderContext $ctx ): string {
		$items = is_array( $props['items'] ?? null ) ? $props['items'] : [];
		$items = array_values(
			array_filter(
				$items,
				static fn( $i ) => is_array( $i ) && ( '' !== trim( (string) ( $i['title'] ?? '' ) ) || '' !== trim( (string) ( $i['price'] ?? '' ) ) )
			)
		);
		if ( ! $items ) {
			return $ctx->isCanvas
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade platos a la carta.', 'meridian' ) . '</p></div>', [ 'class' => 'm-carta is-empty' ] )
				: '';
		}

		$mode   = self::opt( $props['groupMode'] ?? 'tabs', [ 'tabs', 'stacked' ], 'tabs' );
		$theme  = self::theme( $props['theme'] ?? 'light', 'light' );
		$align  = self::align( $props['align'] ?? 'center', 'center' );
		$shape  = self::opt( $props['imageShape'] ?? 'square', [ 'square', 'rounded', 'circle' ], 'square' );
		$leader = self::opt( $props['leader'] ?? 'none', [ 'none', 'dotted', 'solid' ], 'none' );
		$images = ! empty( $props['showImages'] );
		$cats   = self::menu_categories( is_array( $props['categories'] ?? null ) ? $props['categories'] : [], $items );

		$style  = self::col_vars( $props, 2, 1, 1 ) . self::section_style( $props );
		$style .= '--m-carta-img:' . max( 48, min( 320, absint( $props['imageSize'] ?? 96 ) ) ) . 'px;';
		$accent = self::color_value( $props['accent'] ?? null );
		if ( '' !== $accent ) {
			$style .= '--m-carta-accent:' . $accent . ';';
		}
		// Color por tipo de texto. En blanco manda el tema; en cuanto hay
		// color, la carta deja de depender del «Tema» para leerse bien
		// sobre cualquier fondo.
		foreach (
			[
				'titleColor' => '--m-carta-h-c',
				'catColor'   => '--m-carta-cat-c',
				'nameColor'  => '--m-carta-name-c',
				'descColor'  => '--m-carta-desc-c',
				'priceColor' => '--m-carta-price-c',
				'badgeColor' => '--m-carta-badge-c',
			] as $key => $var
		) {
			$c = self::color_value( $props[ $key ] ?? null );
			if ( '' !== $c ) {
				$style .= $var . ':' . $c . ';';
			}
		}

		/* --- cabecera --- */
		$head    = '';
		$icon_id = absint( $props['iconId'] ?? 0 );
		if ( $icon_id ) {
			$w     = max( 16, min( 400, absint( $props['iconWidth'] ?? 56 ) ) );
			$head .= '<span class="m-carta-icon" style="--m-carta-icon-w:' . $w . 'px">'
				. self::media( $ctx, $icon_id, (string) ( $props['iconAlt'] ?? '' ), 'm-carta-icon-img', 'medium' )
				. '</span>';
		}
		$eyebrow = trim( (string) ( $props['eyebrow'] ?? '' ) );
		if ( '' !== $eyebrow ) {
			$head .= '<p class="m-eyebrow">' . esc_html( $eyebrow ) . '</p>';
		}
		$head .= self::display_title(
			(string) ( $props['title'] ?? '' ),
			self::tag( $props['titleTag'] ?? 'h2' ),
			'm-carta-title m-track-' . self::tracking( $props['tracking'] ?? 'normal' ),
			'fade'
		);
		if ( '' !== $head ) {
			$head = '<div class="m-carta-head is-align-' . $align . '">' . $head . '</div>';
		}

		/* --- cuerpo --- */
		$body = '';
		if ( 'stacked' === $mode ) {
			foreach ( $cats as $slug => $cat ) {
				$list = '';
				foreach ( $items as $it ) {
					if ( sanitize_title( (string) ( $it['category'] ?? '' ) ) !== $slug ) {
						continue;
					}
					$list .= self::menu_item( $ctx, $it, $images, $shape );
				}
				if ( '' === $list ) {
					continue;
				}
				$body .= '<section class="m-carta-group">'
					. '<h3 class="m-carta-cat">' . esc_html( $cat['label'] ) . '</h3>'
					. ( '' !== $cat['text'] ? '<p class="m-carta-cat-text">' . esc_html( $cat['text'] ) . '</p>' : '' )
					. '<ul class="m-carta-grid">' . $list . '</ul>'
					. '</section>';
			}
			$loose = '';
			foreach ( $items as $it ) {
				if ( '' !== trim( (string) ( $it['category'] ?? '' ) ) ) {
					continue;
				}
				$loose .= self::menu_item( $ctx, $it, $images, $shape );
			}
			if ( '' !== $loose ) {
				$body .= '<section class="m-carta-group"><ul class="m-carta-grid">' . $loose . '</ul></section>';
			}
		} else {
			$tabs = '';
			if ( $cats ) {
				$all   = trim( (string) ( $props['allLabel'] ?? '' ) );
				$first = '';
				$tabs .= '<div class="m-carta-tabs is-align-' . $align . '" role="group" aria-label="' . esc_attr__( 'Categorías de la carta', 'meridian' ) . '">';
				if ( ! empty( $props['showAll'] ) ) {
					$first = '*';
					$tabs .= '<button type="button" class="m-carta-tab is-on" data-carta-filter="*" aria-pressed="true">'
						. esc_html( '' !== $all ? $all : __( 'Todo', 'meridian' ) ) . '</button>';
				}
				foreach ( $cats as $slug => $cat ) {
					$on    = '' === $first;
					$first = $on ? $slug : $first;
					$tabs .= '<button type="button" class="m-carta-tab' . ( $on ? ' is-on' : '' ) . '" data-carta-filter="' . esc_attr( $slug ) . '"'
						. ' aria-pressed="' . ( $on ? 'true' : 'false' ) . '">' . esc_html( $cat['label'] ) . '</button>';
				}
				$tabs .= '</div>';
			}
			$list = '';
			foreach ( $items as $it ) {
				$list .= self::menu_item( $ctx, $it, $images, $shape );
			}
			$empty = trim( (string) ( $props['emptyLabel'] ?? '' ) );
			$body  = $tabs . '<ul class="m-carta-grid" data-carta-grid>' . $list . '</ul>'
				. '<p class="m-carta-empty" data-carta-empty hidden>' . esc_html( '' !== $empty ? $empty : __( 'No hay platos en esta categoría.', 'meridian' ) ) . '</p>';
		}

		/* --- boton final --- */
		$cta  = '';
		$text = trim( (string) ( $props['linkText'] ?? '' ) );
		if ( '' !== $text ) {
			$map  = [ 'solid' => 'm-btn-primary', 'outline' => 'm-btn-outline', 'ghost' => 'm-btn-ghost' ];
			$bst  = self::opt( $props['buttonStyle'] ?? 'outline', [ 'outline', 'solid', 'ghost' ], 'outline' );
			$cta  = '<div class="m-carta-cta"><a class="m-btn ' . $map[ $bst ] . '" href="'
				. esc_url( (string) ( $props['linkUrl'] ?: '#' ) ) . '">' . esc_html( $text ) . '</a></div>';
		}

		$attrs = [
			'class' => 'm-carta is-theme-' . $theme . ' is-mode-' . $mode . ' is-leader-' . $leader
				. ( $images ? '' : ' is-no-img' ),
			'style' => $style,
		];
		if ( 'tabs' === $mode ) {
			$attrs['data-carta'] = '1';
		}
		$attrs = array_merge( $attrs, self::skin( $theme ) );

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			'<div class="m-container">' . $head . $body . $cta . '</div>',
			$attrs
		);
	}

	/* ------------------------------------------------------------------ */
	/* footer-split (pie partido)                                          */
	/* ------------------------------------------------------------------ */

	/** Icono de red social como SVG en linea (sin peticiones externas). */
	private static function social_icon( string $name ): string {
		$paths = [
			'facebook'  => 'M13.5 9H16V6h-2.5C11.6 6 10 7.6 10 9.5V11H8v3h2v7h3v-7h2.2l.4-3H13V9.8c0-.5.2-.8.5-.8z',
			'instagram' => 'M12 7.2A4.8 4.8 0 1 0 16.8 12 4.81 4.81 0 0 0 12 7.2zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1zm6.1-8.1a1.12 1.12 0 1 1-1.12-1.12A1.12 1.12 0 0 1 18.1 7zM21 7.05a5.57 5.57 0 0 0-1.52-3.93A5.6 5.6 0 0 0 15.55 1.6C14 1.5 10 1.5 8.45 1.6a5.6 5.6 0 0 0-3.93 1.52A5.57 5.57 0 0 0 3 7.05c-.1 1.55-.1 6.35 0 7.9a5.57 5.57 0 0 0 1.52 3.93 5.61 5.61 0 0 0 3.93 1.52c1.55.1 6.35.1 7.9 0a5.57 5.57 0 0 0 3.93-1.52A5.6 5.6 0 0 0 21 14.95c.1-1.55.1-6.34 0-7.9z',
			'x'         => 'M17.5 3h3l-6.6 7.6L21.8 21h-6l-4.7-6.1L5.7 21H2.6l7-8-6.7-10h6.1l4.3 5.6zM16.4 19.2h1.7L7.7 4.7H5.9z',
			'youtube'   => 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z',
			'linkedin'  => 'M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.5 8.5h3v12h-3zM9.5 8.5h2.9v1.6h.04A3.2 3.2 0 0 1 15.3 8.3c3.1 0 3.7 2 3.7 4.7v7.5h-3v-6.6c0-1.6 0-3.6-2.2-3.6s-2.5 1.7-2.5 3.5v6.7h-3z',
			'tiktok'    => 'M16.5 3a5.3 5.3 0 0 0 4.2 4.1v3a8.2 8.2 0 0 1-4.2-1.2v6.4a6.2 6.2 0 1 1-6.2-6.2c.3 0 .6 0 .9.1v3.1a3.2 3.2 0 1 0 2.2 3V3z',
			'whatsapp'  => 'M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2s-1 .2-3.3-.7a11.6 11.6 0 0 1-4.8-4.2 5.5 5.5 0 0 1-1.1-2.9 3.1 3.1 0 0 1 1-2.3 1 1 0 0 1 .7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6a8.5 8.5 0 0 0 1.5 1.9 7.7 7.7 0 0 0 2.2 1.4c.3.1.4.1.6-.1l.8-1c.2-.2.3-.2.6-.1l2 .9c.3.1.5.2.6.3a2.1 2.1 0 0 1-.4 1.8z',
			'pinterest' => 'M12 2a10 10 0 0 0-3.6 19.3 9.6 9.6 0 0 1 0-2.9l1.2-5a3.6 3.6 0 0 1-.3-1.5c0-1.4.8-2.5 1.9-2.5a1.3 1.3 0 0 1 1.3 1.5 20 20 0 0 1-.8 3.4 1.5 1.5 0 0 0 1.5 1.9c1.8 0 3.2-1.9 3.2-4.7a4 4 0 0 0-4.3-4.2 4.5 4.5 0 0 0-4.6 4.5 4 4 0 0 0 .8 2.4.3.3 0 0 1 .1.3l-.3 1.1c0 .2-.2.3-.4.2-1.3-.6-2.1-2.4-2.1-3.9 0-3.2 2.3-6.1 6.7-6.1a6 6 0 0 1 6.2 5.8c0 3.5-2.2 6.3-5.3 6.3a2.7 2.7 0 0 1-2.3-1.2l-.6 2.4a11 11 0 0 1-1.3 2.7A10 10 0 1 0 12 2z',
			'github'    => 'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3a2.7 2.7 0 0 0-1.1-1.5c-.9-.6.1-.6.1-.6a2.1 2.1 0 0 1 1.6 1 2.2 2.2 0 0 0 3 .9 2.2 2.2 0 0 1 .6-1.4c-2.2-.2-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.3 4.8-4.6 5a2.5 2.5 0 0 1 .7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z',
			'dribbble'  => 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.6 4.6a8.3 8.3 0 0 1 1.9 5.2 19.8 19.8 0 0 0-5.8-.3c-.2-.6-.5-1.1-.8-1.7a11.7 11.7 0 0 0 4.7-3.2zM12 3.5a8.4 8.4 0 0 1 5.5 2.1 10 10 0 0 1-4.3 2.8A29 29 0 0 0 9.7 3.8 8.5 8.5 0 0 1 12 3.5zM8 4.4a34 34 0 0 1 3.5 4.6 27 27 0 0 1-7.3 1A8.6 8.6 0 0 1 8 4.4zM3.5 12v-.3a29 29 0 0 0 8.6-1.2l.6 1.3A11.2 11.2 0 0 0 7 17.7 8.4 8.4 0 0 1 3.5 12zm8.5 8.5a8.4 8.4 0 0 1-5-1.7 9.6 9.6 0 0 1 5.1-5.4 32 32 0 0 1 1.7 6.6 8.4 8.4 0 0 1-1.8.5zm3.3-1.2a34 34 0 0 0-1.6-6.1 15.6 15.6 0 0 1 5-.1 8.5 8.5 0 0 1-3.4 6.2z',
			'email'     => 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8.1L4.6 7H19.4zM4 17h16V8.5l-7.4 6.2a1 1 0 0 1-1.2 0L4 8.5z',
			'phone'     => 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1z',
			'link'      => 'M10.6 13.4a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 1.4l-1.4 1.4a1 1 0 0 1-1.4 0zM8.5 17.9a4 4 0 0 1-2.8-6.8l2.8-2.8a1 1 0 0 1 1.4 1.4l-2.8 2.8a2 2 0 0 0 2.8 2.8l2.8-2.8a1 1 0 0 1 1.4 1.4l-2.8 2.8a4 4 0 0 1-2.8 1.2zm9.8-5.1a1 1 0 0 1-.7-1.7l1.7-1.7a2 2 0 1 0-2.8-2.8l-2.8 2.8a1 1 0 0 1-1.4-1.4l2.8-2.8a4 4 0 0 1 5.6 5.6l-1.7 1.7a1 1 0 0 1-.7.3z',
		];
		$key  = isset( $paths[ $name ] ) ? $name : 'link';
		return '<svg class="m-soc-ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">'
			. '<path fill="currentColor" d="' . $paths[ $key ] . '"/></svg>';
	}

	public static function footer_split( array $node, array $props, string $children, RenderContext $ctx ): string {
		$side   = ( ( $props['mediaSide'] ?? 'left' ) === 'right' ) ? 'right' : 'left';
		$ratio  = self::opt( $props['ratio'] ?? 'half', [ 'half', 'media-wide', 'copy-wide' ], 'half' );
		$height = self::opt( $props['height'] ?? 'auto', [ 'auto', 'medium', 'tall', 'screen', 'custom' ], 'auto' );
		$fit    = ( ( $props['mediaFit'] ?? 'cover' ) === 'contain' ) ? 'contain' : 'cover';
		$theme  = self::theme( $props['theme'] ?? 'light', 'light' );
		$align  = self::align( $props['align'] ?? 'left' );
		$track  = self::tracking( $props['tracking'] ?? 'normal' );

		$style = '';
		if ( 'custom' === $height ) {
			$unit   = ( ( $props['heightUnit'] ?? 'px' ) === 'vh' ) ? 'svh' : 'px';
			$max    = 'px' === $unit ? 4000 : 400;
			$value  = max( 1, min( $max, absint( $props['heightValue'] ?? 460 ) ) );
			$style .= '--m-fs-h:' . $value . $unit . ';';
		}

		/* --- panel de imagen --- */
		$img_id = absint( $props['imageId'] ?? 0 );
		$media  = '';
		if ( $img_id ) {
			$media = '<div class="m-fs-media is-fit-' . $fit . '">'
				. self::media( $ctx, $img_id, (string) ( $props['alt'] ?? '' ), 'm-fs-img' )
				. '</div>';
		}

		/* --- bloque de contacto --- */
		$contact = '';
		$logo_id = absint( $props['logoId'] ?? 0 );
		if ( $logo_id ) {
			$lw       = max( 40, min( 600, absint( $props['logoWidth'] ?? 160 ) ) );
			$contact .= '<div class="m-fs-logo" style="--m-fs-logo-w:' . $lw . 'px">'
				. self::media( $ctx, $logo_id, (string) ( $props['logoAlt'] ?? '' ), 'm-fs-logo-img', 'medium' )
				. '</div>';
		}
		$eyebrow = trim( (string) ( $props['eyebrow'] ?? '' ) );
		if ( '' !== $eyebrow ) {
			$contact .= '<p class="m-eyebrow m-fs-eyebrow">' . esc_html( $eyebrow ) . '</p>';
		}
		$phone = trim( (string) ( $props['phone'] ?? '' ) );
		if ( '' !== $phone ) {
			$href = trim( (string) ( $props['phoneUrl'] ?? '' ) );
			if ( '' === $href ) {
				$digits = preg_replace( '/[^0-9+]/', '', $phone );
				$href   = strlen( (string) $digits ) >= 6 ? 'tel:' . $digits : '';
			}
			$big = '<span class="m-fs-phone m-track-' . $track . '">' . esc_html( $phone ) . '</span>';
			$contact .= '' !== $href
				? '<p class="m-fs-phone-row"><a class="m-fs-phone-link" href="' . esc_url( $href ) . '">' . $big . '</a></p>'
				: '<p class="m-fs-phone-row">' . $big . '</p>';
		}
		$lines = is_array( $props['lines'] ?? null ) ? $props['lines'] : [];
		$rows  = '';
		foreach ( $lines as $l ) {
			$t = is_array( $l ) ? trim( (string) ( $l['text'] ?? '' ) ) : '';
			if ( '' !== $t ) {
				$rows .= '<li>' . esc_html( $t ) . '</li>';
			}
		}
		if ( '' !== $rows ) {
			$contact .= '<ul class="m-fs-lines">' . $rows . '</ul>';
		}
		$social = is_array( $props['social'] ?? null ) ? $props['social'] : [];
		$socs   = '';
		foreach ( $social as $s ) {
			if ( ! is_array( $s ) ) {
				continue;
			}
			$url = trim( (string) ( $s['url'] ?? '' ) );
			if ( '' === $url ) {
				continue;
			}
			$net   = sanitize_key( (string) ( $s['network'] ?? 'link' ) );
			$label = trim( (string) ( $s['label'] ?? '' ) );
			$label = '' !== $label ? $label : ucfirst( $net );
			$socs .= '<li><a class="m-fs-soc" href="' . esc_url( $url ) . '" target="_blank" rel="noopener noreferrer">'
				. self::social_icon( $net )
				. '<span class="screen-reader-text">' . esc_html( $label ) . '</span></a></li>';
		}
		if ( '' !== $socs ) {
			$contact .= '<ul class="m-fs-social">' . $socs . '</ul>';
		}
		if ( '' !== $contact ) {
			$contact = '<div class="m-fs-contact">' . $contact . '</div>';
		}

		/* --- columnas de enlaces --- */
		$columns = is_array( $props['columns'] ?? null ) ? $props['columns'] : [];
		$links   = is_array( $props['links'] ?? null ) ? $props['links'] : [];
		$cols    = [];
		foreach ( $columns as $c ) {
			$title = is_array( $c ) ? trim( (string) ( $c['title'] ?? '' ) ) : '';
			if ( '' === $title ) {
				continue;
			}
			$cols[ sanitize_title( $title ) ] = [
				'title' => $title,
				'items' => [],
			];
		}
		$loose = [];
		foreach ( $links as $l ) {
			if ( ! is_array( $l ) ) {
				continue;
			}
			$label = trim( (string) ( $l['label'] ?? '' ) );
			if ( '' === $label ) {
				continue;
			}
			$key = sanitize_title( (string) ( $l['column'] ?? '' ) );
			if ( '' !== $key && isset( $cols[ $key ] ) ) {
				$cols[ $key ]['items'][] = $l;
			} elseif ( '' !== $key ) {
				$cols[ $key ] = [
					'title' => trim( (string) $l['column'] ),
					'items' => [ $l ],
				];
			} else {
				$loose[] = $l;
			}
		}
		if ( $loose ) {
			$cols[] = [
				'title' => '',
				'items' => $loose,
			];
		}
		$nav = '';
		foreach ( $cols as $col ) {
			if ( ! $col['items'] ) {
				continue;
			}
			$list = '';
			foreach ( $col['items'] as $l ) {
				$blank = ! empty( $l['newTab'] ) ? ' target="_blank" rel="noopener noreferrer"' : '';
				$list .= '<li><a href="' . esc_url( (string) ( $l['url'] ?? '' ) ?: '#' ) . '"' . $blank . '>'
					. esc_html( (string) $l['label'] ) . '</a></li>';
			}
			$nav .= '<div class="m-fs-col">'
				. ( '' !== $col['title'] ? '<h3 class="m-fs-col-title">' . esc_html( $col['title'] ) . '</h3>' : '' )
				. '<ul class="m-fs-links">' . $list . '</ul></div>';
		}
		if ( '' !== $nav ) {
			$nav = '<nav class="m-fs-cols" aria-label="' . esc_attr__( 'Enlaces del pie', 'meridian' ) . '">' . $nav . '</nav>';
		}

		/* --- linea legal --- */
		$legal = is_array( $props['legal'] ?? null ) ? $props['legal'] : [];
		$legs  = '';
		foreach ( $legal as $l ) {
			$label = is_array( $l ) ? trim( (string) ( $l['label'] ?? '' ) ) : '';
			if ( '' === $label ) {
				continue;
			}
			$legs .= '<li><a href="' . esc_url( (string) ( $l['url'] ?? '' ) ?: '#' ) . '">' . esc_html( $label ) . '</a></li>';
		}
		$copy   = trim( (string) ( $props['copyright'] ?? '' ) );
		$bottom = '';
		if ( '' !== $legs || '' !== $copy ) {
			$bottom = '<div class="m-fs-bottom' . ( empty( $props['showRule'] ) ? '' : ' has-rule' ) . '">'
				. ( '' !== $legs ? '<ul class="m-fs-legal">' . $legs . '</ul>' : '<span></span>' )
				. ( '' !== $copy ? '<p class="m-fs-copy">' . esc_html( $copy ) . '</p>' : '' )
				. '</div>';
		}

		$panel_style = self::theme_style( $props );
		$panel       = '<div class="m-fs-panel is-theme-' . $theme . ' is-align-' . $align . '"'
			. ( '' !== $panel_style ? ' style="' . esc_attr( $panel_style ) . '"' : '' ) . '>'
			. '<div class="m-fs-panel-inner">'
			. ( '' !== $contact || '' !== $nav ? '<div class="m-fs-top">' . $contact . $nav . '</div>' : '' )
			. $bottom
			. '</div></div>';

		if ( '' === $media && '' === $contact && '' === $nav && '' === $bottom ) {
			return $ctx->isCanvas
				? ComponentRenders::wrap( $node, $ctx, 'div', '<div class="m-container"><p class="m-muted">' . esc_html__( 'Añade contenido al pie partido.', 'meridian' ) . '</p></div>', [ 'class' => 'm-fs is-empty' ] )
				: '';
		}

		$grid = 'left' === $side ? $media . $panel : $panel . $media;

		return ComponentRenders::wrap(
			$node,
			$ctx,
			'div',
			'<div class="m-fs-grid">' . $grid . '</div>',
			array_merge(
				[
					'class' => 'm-fs is-media-' . $side . ' is-ratio-' . $ratio . ' is-h-' . $height
						. ( '' === $media ? ' is-no-media' : '' ),
					'style' => $style,
				],
				self::skin( $theme )
			)
		);
	}
}
