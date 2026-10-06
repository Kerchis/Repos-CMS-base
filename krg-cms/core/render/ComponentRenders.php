<?php
/**
 * HTML for every built-in component. Content comes from props only.
 *
 * @package Meridian
 */

namespace Meridian\Render;

defined( 'ABSPATH' ) || exit;

class ComponentRenders {

	public static function render( string $type, array $node, array $props, string $children, RenderContext $ctx ): string {
		$method = str_replace( '-', '_', $type );
		if ( method_exists( self::class, $method ) ) {
			return self::$method( $node, $props, $children, $ctx );
		}
		if ( class_exists( BrandRenders::class ) && method_exists( BrandRenders::class, $method ) ) {
			return BrandRenders::$method( $node, $props, $children, $ctx );
		}
		return self::generic( $node, $props, $children, $ctx );
	}

	/**
	 * Añade los atributos que el usuario escribio en «Avanzado».
	 *
	 * Van despues de los del bloque pero sin pisarlos: si un modulo ya
	 * decidio su `role` o su `data-anim-in`, manda el modulo. El filtro
	 * de que se puede escribir esta en el guardado
	 * (`Sanitizer::html_attrs()`), no aqui: esto solo imprime.
	 */
	public static function with_user_attrs( array $node, array $attrs ): array {
		$propios = is_array( $node['attrs'] ?? null ) ? $node['attrs'] : [];
		foreach ( $propios as $k => $v ) {
			$k = strtolower( (string) $k );
			if ( '' === $k || isset( $attrs[ $k ] ) || in_array( $k, [ 'class', 'id', 'style' ], true ) ) {
				continue;
			}
			// Cinturon y tirantes: el guardado ya rechaza los manejadores
			// de eventos, pero un documento viejo o importado a mano no
			// ha pasado por el. Un `onclick` no se imprime nunca.
			if ( 0 === strpos( $k, 'on' ) ) {
				continue;
			}
			$attrs[ $k ] = (string) $v;
		}
		return $attrs;
	}

	public static function wrap( array $node, RenderContext $ctx, string $tag, string $inner, array $attrs = [] ): string {
		$class = $ctx->node_class( $node );
		if ( ! empty( $attrs['class'] ) ) {
			$class .= ' ' . $attrs['class'];
			unset( $attrs['class'] );
		}
		$props = is_array( $node['props'] ?? null ) ? $node['props'] : [];
		$type  = $node['type'] ?? '';
		$h     = sanitize_html_class( (string) ( $props['alignH'] ?? 'start' ) );
		$v     = sanitize_html_class( (string) ( $props['alignV'] ?? 'start' ) );
		if ( 'column' === $type ) {
			$h = sanitize_html_class( (string) ( $props['contentHAlign'] ?? $h ) );
			$v = sanitize_html_class( (string) ( $props['contentVAlign'] ?? $v ) );
		}
		if ( in_array( $h, [ 'center', 'end', 'stretch' ], true ) ) {
			$class .= ' m-align-h-' . $h;
		}
		if ( 'row' !== $type && in_array( $v, [ 'center', 'end', 'stretch' ], true ) ) {
			$class .= ' m-align-v-' . $v;
		}
		$dist = sanitize_html_class( (string) ( $props['distribute'] ?? 'none' ) );
		if ( in_array( $dist, [ 'x', 'y' ], true ) ) {
			$class .= ' is-dist-' . $dist;
		}
		if ( ! empty( $node['htmlClass'] ) ) {
			$class .= ' ' . $node['htmlClass'];
		}
		$anim = sanitize_html_class( (string) ( $node['animation'] ?? '' ) );
		if ( $anim && 'none' !== $anim ) {
			$class .= ' m-anim-' . $anim;
			$attrs['data-anim-in'] = $anim;
		}
		if ( empty( $attrs['id'] ) && ! empty( $node['htmlId'] ) ) {
			$attrs['id'] = $node['htmlId'];
		} elseif ( empty( $attrs['id'] ) && ! empty( $node['props']['htmlId'] ) ) {
			$attrs['id'] = sanitize_html_class( (string) $node['props']['htmlId'] );
		}
		// Aqui NO se escribe nada de lo que el usuario puso en el panel.
		//
		// Antes se copiaba el tamaño de escritorio al atributo `style`
		// «por si acaso». Eran dos emisores del mismo valor: el atributo
		// ganaba siempre —tiene mas peso que cualquier hoja— y por eso
		// las reglas de tablet y movil necesitaban `!important` para
		// poder corregirlo. Con un solo emisor (la hoja del documento)
		// los tres tamaños compiten en igualdad y el que manda es el del
		// tamaño que se esta viendo. El atributo queda para lo que es
		// del bloque: variables como `--m-sec-h` o el parallax.
		$attrs = self::with_user_attrs( $node, $attrs );
		$extra = '';
		foreach ( $attrs as $k => $v ) {
			if ( $v === '' || $v === null ) {
				continue;
			}
			$extra .= ' ' . $k . '="' . esc_attr( (string) $v ) . '"';
		}
		return '<' . $tag . ' class="' . esc_attr( $class ) . '"' . $ctx->preview_attrs( $node['id'] ?? '' ) . $extra . '>' . $inner . '</' . $tag . '>';
	}

	public static function btn( array $b ): string {
		$variant = sanitize_html_class( $b['variant'] ?? 'primary' );
		$url     = $b['url'] ?? '#';
		$target  = ( $b['target'] ?? '_self' ) === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
		$text    = esc_html( $b['text'] ?? '' );
		$rel     = ( $b['target'] ?? '' ) === '_blank' ? '' : '';
		return '<a class="m-btn m-btn-' . $variant . '" href="' . esc_url( $url ) . '"' . $target . $rel . '>' . $text . '</a>';
	}

	/**
	 * Los atributos del parallax, en un solo sitio.
	 *
	 * El motor de `public.js` lee `data-parallax-zoom|amount|dir` de la
	 * caja y `--m-px-zoom` para la ampliacion de partida. Lo usaban la
	 * imagen y la galeria con dos copias identicas; a la tercera (el CTA
	 * display) se consolida, que es lo contrario de hacer un sistema
	 * nuevo para cada bloque.
	 *
	 * Devuelve los atributos ya mezclados: clase con `is-parallax` y el
	 * `style` con la variable anadida detras de lo que ya hubiera.
	 */
	public static function parallax_attrs( array $props, array $attrs ): array {
		if ( empty( $props['parallax'] ) ) {
			return $attrs;
		}
		$zoom   = max( 0, min( 40, (int) ( $props['parallaxZoom'] ?? 8 ) ) );
		$amount = max( 0, min( 40, (int) ( $props['parallaxAmount'] ?? 10 ) ) );
		$style  = (string) ( $attrs['style'] ?? '' );
		$px     = '--m-px-zoom:' . ( 1 + ( $zoom / 100 ) );

		$attrs['class']                = trim( (string) ( $attrs['class'] ?? '' ) . ' is-parallax' );
		$attrs['style']                = '' === $style ? $px : rtrim( $style, ';' ) . ';' . $px;
		$attrs['data-parallax-zoom']   = (string) $zoom;
		$attrs['data-parallax-amount'] = (string) $amount;
		$attrs['data-parallax-dir']    = ! empty( $props['parallaxInvert'] ) ? '-1' : '1';
		return $attrs;
	}

	/**
	 * La puerta por la que salen las fotos de los bloques.
	 *
	 * El `$papel` dice cuánto ocupa de verdad en la pantalla —ancho
	 * completo, media, una de tres, un icono— y de ahí sale el `sizes`
	 * que hace que el navegador se baje el archivo del tamaño que toca
	 * y no el grande siempre. Quien no lo diga se queda con el de
	 * antes, que es el ancho del contenido.
	 */
	public static function img( RenderContext $ctx, int $id, string $alt = '', string $class = '', string $size = 'large', bool $eager = false, $papel = null ): string {
		if ( ! $id ) {
			return \Meridian\Media\Images::placeholder();
		}
		$html = \Meridian\Media\Images::tag(
			$id,
			$size,
			[
				'alt'   => $alt,
				'class' => $class,
				'eager' => $eager,
				'papel' => $papel ?? $ctx->fraccion,
			]
		);
		return $html ?: \Meridian\Media\Images::placeholder();
	}

	/** Tipos que solo sirven para colocar: por si solos no son contenido. */
	private const LAYOUT_ONLY = [ 'section', 'row', 'column' ];

	/**
	 * ¿Hay algo real dentro de este nodo?
	 *
	 * Baja por filas y columnas hasta encontrar un modulo de verdad. Una
	 * seccion con una fila con tres columnas vacias sigue estando vacia: lo
	 * que cuenta es que haya un bloque con contenido en alguna rama.
	 */
	private static function has_content( array $node, bool $canvas = false ): bool {
		return [] !== self::module_types( $node, 1, $canvas );
	}

	/**
	 * ¿Este nodo pinta algo en la web pública?
	 *
	 * No basta con que exista. Un modulo apagado con el interruptor de
	 * visibilidad, o escondido a la vez en escritorio, tableta y movil, no
	 * llega a verse nunca: para el frontend es como si no estuviera. En el
	 * lienzo del constructor si cuenta, porque ahi se esta editando.
	 */
	private static function node_counts( array $node, bool $canvas ): bool {
		if ( $canvas ) {
			return true;
		}
		if ( array_key_exists( 'visible', $node ) && ! $node['visible'] ) {
			return false;
		}
		$hidden = $node['hiddenOn'] ?? [];
		if ( ! is_array( $hidden ) ) {
			return true;
		}
		return ! ( ! empty( $hidden['desktop'] ) && ! empty( $hidden['tablet'] ) && ! empty( $hidden['mobile'] ) );
	}

	/**
	 * Modulos que viven dentro de un nodo, bajando por filas y columnas.
	 *
	 * Devuelve los tipos encontrados, como mucho `$limit`. Con limite 1
	 * responde a «¿hay algo?»; con limite 2 responde a «¿hay exactamente
	 * uno?», que es lo que decide si ese modulo puede mandar en el alto.
	 *
	 * @param int $limit Cuantos tipos hacen falta antes de parar.
	 * @return string[]
	 */
	private static function module_types( array $node, int $limit = 2, bool $canvas = false ): array {
		$found    = [];
		$children = $node['children'] ?? null;
		if ( ! is_array( $children ) ) {
			return $found;
		}
		foreach ( $children as $child ) {
			if ( ! is_array( $child ) ) {
				continue;
			}
			$type = (string) ( $child['type'] ?? '' );
			if ( '' === $type ) {
				continue;
			}
			if ( ! self::node_counts( $child, $canvas ) ) {
				continue;
			}
			if ( in_array( $type, self::LAYOUT_ONLY, true ) ) {
				foreach ( self::module_types( $child, $limit, $canvas ) as $t ) {
					$found[] = $t;
					if ( count( $found ) >= $limit ) {
						return $found;
					}
				}
				continue;
			}
			$found[] = $type;
			if ( count( $found ) >= $limit ) {
				return $found;
			}
		}
		return $found;
	}

	/**
	 * Modulos que traen su propio alto medido en pantallas.
	 *
	 * Son los unicos que pueden chocar con el alto de la seccion: si el
	 * panel mide 78svh y la seccion 100svh, sobra el 22% y se ve como una
	 * franja vacia. Cuando uno de estos es lo unico que hay dentro, el
	 * alto de la seccion manda y el modulo lo rellena.
	 */
	private const FILL_MODULES = [ 'split-panel', 'brand-hero', 'map' ];

	public static function section( array $node, array $props, string $children, RenderContext $ctx ): string {
		// Una seccion sin contenido real no se imprime.
		//
		// Es la unica forma de que no reserve espacio pase lo que pase: sin
		// etiqueta no hay alto, ni relleno, ni margen, ni contenedor que
		// estirar, ni nada que el CSS o el JavaScript puedan devolverle.
		// Antes se colapsaba con CSS y siempre quedaba un camino abierto —
		// un alto exacto, un `height` en linea, una altura a medida.
		//
		// «Sin contenido real» se decide sobre el arbol del documento, no
		// sobre el marcado: filas y columnas son andamiaje, no contenido,
		// asi que una fila con tres columnas vacias sigue estando vacia. Lo
		// apagado o escondido en los tres tamanos tampoco cuenta.
		//
		// En el lienzo del constructor si se imprime: alli hace falta poder
		// seleccionarla y soltarle algo dentro.
		$empty = ( '' === trim( $children ) ) || ! self::has_content( $node, $ctx->isCanvas );
		if ( $empty && ! $ctx->isCanvas ) {
			return '';
		}
		$inner = '<div class="m-container">' . $children . '</div>';
		$fw    = $props['fullWidth'] ?? true;
		$full  = ! ( false === $fw || 0 === $fw || '0' === $fw || '' === $fw );
		$mh    = sanitize_html_class( (string) ( $props['minHeight'] ?? 'auto' ) );
		if ( ! in_array( $mh, [ 'auto', 'screen', 'screen-minus-header', 'tall', 'half', 'custom' ], true ) ) {
			$mh = 'auto';
		}
		// Alto a medida: en píxeles o en porcentaje de la pantalla.
		//
		// `heightMode` decide quién manda cuando dentro hay un módulo con su
		// propio alto (un panel partido a pantalla completa, por ejemplo).
		// Con «exact» manda la sección y el módulo se adapta; con «min» el
		// valor es sólo un mínimo y el módulo puede estirarlo. Antes sólo
		// existía el segundo caso, así que fijar el alto de la sección no
		// hacía nada visible: un mínimo nunca encoge a lo que lleva dentro.
		$mh_style = '';
		$mh_mode  = '';
		if ( 'custom' === $mh ) {
			$mh_unit  = ( ( $props['minHeightUnit'] ?? 'vh' ) === 'px' ) ? 'px' : 'svh';
			$mh_cap   = 'px' === $mh_unit ? 4000 : 400;
			$mh_val   = max( 1, min( $mh_cap, absint( $props['minHeightValue'] ?? 60 ) ) );
			$mh_style = '--m-sec-h:' . $mh_val . $mh_unit;
			$mh_mode  = ( 'min' === ( $props['heightMode'] ?? 'exact' ) ) ? ' is-h-min' : ' is-h-exact';
		}
		$va = sanitize_html_class( (string) ( $props['vAlign'] ?? 'start' ) );
		if ( ! in_array( $va, [ 'start', 'center', 'end', 'stretch' ], true ) ) {
			$va = 'start';
		}
		// `width` manda; `fullWidth` se mantiene para el contenido ya creado.
		$width = sanitize_key( (string) ( $props['width'] ?? '' ) );
		if ( 'bleed' === $width ) {
			$width = 'full';
		}
		if ( ! in_array( $width, [ 'boxed', 'full', 'padded' ], true ) ) {
			$width = $full ? 'full' : 'boxed';
		}
		$class = ( 'boxed' === $width ? 'is-boxed' : 'is-full' ) . ' is-w-' . $width;
		if ( 'auto' !== $mh ) {
			$class .= ' is-mh-' . $mh . $mh_mode . ' is-va-' . $va;
			// Con «Estirar» el bloque ocupa todo el alto, asi que donde
			// queda su contenido deja de decidirlo `is-va-*`: hace falta
			// un segundo eje. Solo se imprime cuando sirve para algo.
			if ( 'stretch' === $va ) {
				$sa = sanitize_html_class( (string) ( $props['stretchAlign'] ?? 'center' ) );
				if ( ! in_array( $sa, [ 'start', 'center', 'end' ], true ) ) {
					$sa = 'center';
				}
				$class .= ' is-sa-' . $sa;
			}
		}
		// Llegar aqui vacio solo pasa en el lienzo del constructor: la
		// marca sirve para colapsar el alto configurado y dejar en su sitio
		// una banda baja que se pueda seleccionar y usar como destino.
		if ( $empty ) {
			$class .= ' is-no-content';
		} elseif ( 'auto' !== $mh && ' is-h-exact' !== $mh_mode ) {
			// Dos alturas independientes para la misma caja: la de la
			// seccion y la del modulo que lleva dentro. Si el modulo mide
			// menos, la diferencia se veia como una franja de fondo vacia
			// debajo del contenido. Cuando ese modulo es lo unico que hay,
			// manda el alto de la seccion y el modulo lo rellena. El alto
			// propio del modulo se conserva como minimo, asi que nunca se
			// recorta: solo crece. Con «La seccion manda» (`is-h-exact`)
			// ya existe una cadena propia que ademas recorta, y con el alto
			// «Automatica» no hay nada que rellenar.
			$types = self::module_types( $node, 2, $ctx->isCanvas );
			if ( 1 === count( $types ) && in_array( $types[0], self::FILL_MODULES, true ) ) {
				$class .= ' is-fill-height';
			}
		}
		// Cortina: la sección se queda quieta y la siguiente la tapa al subir.
		if ( 'on' === sanitize_key( (string) ( $props['curtain'] ?? 'off' ) ) ) {
			$class .= ' is-curtain';
		}
		$attrs = [ 'class' => $class ];

		// Cabecera adaptativa: la sección declara qué color de texto necesita
		// la cabecera cuando pasa por encima. `auto` lo deduce del fondo.
		$skin = sanitize_key( (string) ( $props['headerSkin'] ?? 'auto' ) );
		if ( 'auto' === $skin ) {
			$skin = \Meridian\Design\Contrast::for_color( $node['styles']['desktop']['background-color'] ?? null );
		}
		if ( in_array( $skin, [ 'light', 'dark' ], true ) ) {
			$attrs['data-header-skin'] = $skin;
		}
		if ( ! empty( $props['htmlId'] ) ) {
			$attrs['id'] = sanitize_html_class( $props['htmlId'] );
		}
		// El fondo no se escribe aqui: lo emite la hoja del documento a
		// partir de `styles`, que es su unica fuente. Antes se escribia en
		// este atributo Y en la hoja, y salia `background:...;background:...`
		// en la misma etiqueta, ganando por orden y no por decision.
		$style = [];
		if ( $mh_style ) {
			$style[] = $mh_style;
		}
		if ( $style ) {
			$attrs['style'] = implode( ';', $style );
		}
		return self::wrap( $node, $ctx, 'section', $inner, $attrs );
	}

	public static function container( array $node, array $props, string $children, RenderContext $ctx ): string {
		$class = ! empty( $props['narrow'] ) ? 'm-container m-container-narrow' : 'm-container';
		return self::wrap( $node, $ctx, 'div', $children, [ 'class' => $class ] );
	}

	public static function columns( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::wrap( $node, $ctx, 'div', $children, [ 'class' => 'm-columns' ] );
	}

	public static function row( array $node, array $props, string $children, RenderContext $ctx ): string {
		if ( self::is_void( $node, $children, $ctx ) ) {
			return '';
		}
		$va = sanitize_html_class( (string) ( $props['vAlign'] ?? 'start' ) );
		if ( ! in_array( $va, [ 'start', 'center', 'end', 'stretch' ], true ) ) {
			$va = 'start';
		}
		return self::wrap( $node, $ctx, 'div', $children, [ 'class' => 'm-row m-valign-' . $va ] );
	}

	/**
	 * ¿Este andamio se quedó sin nada que sujetar?
	 *
	 * Una fila o una columna que declara modulos pero cuyo marcado sale
	 * vacio no pinta: el modulo decidio no imprimir nada (una rejilla de
	 * blog sin entradas, una carta sin platos). Devolver cadena vacia hace
	 * que la seccion de arriba se vea a si misma vacia y no reserve ni un
	 * pixel, que es la regla del sistema.
	 *
	 * No vale para el andamio sin modulos: una columna vacia con su ancho
	 * es un hueco colocado a proposito en la rejilla, y en el lienzo del
	 * constructor todo se conserva para poder seleccionarlo.
	 */
	private static function is_void( array $node, string $children, RenderContext $ctx ): bool {
		if ( $ctx->isCanvas || '' !== trim( $children ) ) {
			return false;
		}
		return self::has_content( $node, false );
	}

	public static function column( array $node, array $props, string $children, RenderContext $ctx ): string {
		if ( $ctx->isCanvas && trim( $children ) === '' ) {
			$children = '<div class="m-col-empty">' . esc_html__( 'Grupo vacío — selecciona esta columna y añade un módulo.', 'meridian' ) . '</div>';
		}
		// Una columna que lleva modulos dentro pero no ha pintado nada
		// —una rejilla de blog sin entradas, un carrusel sin resenas— no
		// deja rastro: asi la seccion que la contiene puede darse por
		// vacia y no reservar espacio. Una columna sin modulos si se
		// conserva: es un hueco puesto a proposito en la rejilla.
		if ( self::is_void( $node, $children, $ctx ) ) {
			return '';
		}
		$cv    = sanitize_html_class( (string) ( $props['contentVAlign'] ?? 'start' ) );
		$ch    = sanitize_html_class( (string) ( $props['contentHAlign'] ?? 'start' ) );
		$class = 'm-col';
		if ( in_array( $cv, [ 'center', 'end' ], true ) ) {
			$class .= ' m-content-v-' . $cv;
		}
		if ( in_array( $ch, [ 'center', 'end' ], true ) ) {
			$class .= ' m-content-h-' . $ch;
		}
		return self::wrap( $node, $ctx, 'div', $children, [ 'class' => $class ] );
	}

	public static function spacer( array $node, array $props, string $children, RenderContext $ctx ): string {
		$h = absint( $props['height'] ?? 48 );
		return self::wrap( $node, $ctx, 'div', '', [ 'style' => 'height:' . $h . 'px', 'aria-hidden' => 'true' ] );
	}

	public static function divider( array $node, array $props, string $children, RenderContext $ctx ): string {
		$style = ( $props['style'] ?? 'solid' ) === 'dashed' ? 'dashed' : 'solid';
		return self::wrap( $node, $ctx, 'hr', '', [ 'class' => 'm-divider is-' . $style ] );
	}

	/**
	 * Un campo de prosa, listo para imprimir.
	 *
	 * Los campos de texto de los modulos se escriben con el editor
	 * visual del panel, que deja marcas dentro de la linea: una
	 * palabra en negrita, una cursiva, un enlace. Si el renderizador
	 * las escapara, el lector veria «<strong>» en pantalla.
	 *
	 * Por eso aqui no se escapa: se filtra. `Sanitizer::inline()`
	 * aplica la misma lista blanca corta que el guardado, asi que lo
	 * que no sea una marca de linea se cae, tambien si el texto venia
	 * de antes o lo escribio otro plugin. Para el texto plano sigue
	 * estando `esc_html()`.
	 */
	public static function prosa( $value ): string {
		return \Meridian\Security\Sanitizer::inline( (string) $value );
	}

	/**
	 * El mismo campo, en texto plano.
	 *
	 * Para un atributo —el `alt` de una foto, un `title`— no vale el
	 * HTML: ahi hay que escribir las palabras y nada mas.
	 */
	public static function texto_plano( $value ): string {
		return trim( html_entity_decode( wp_strip_all_tags( (string) $value ), ENT_QUOTES, 'UTF-8' ) );
	}

	/** Lo mismo, respetando los saltos de linea manuales. */
	public static function prosa_br( $value ): string {
		return nl2br( self::prosa( $value ) );
	}

	public static function heading( array $node, array $props, string $children, RenderContext $ctx ): string {
		$tag  = in_array( $props['tag'] ?? '', [ 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p' ], true ) ? $props['tag'] : 'h2';
		$text = self::prosa( $props['text'] ?? '' );
		$link = $props['link'] ?? '';
		if ( $link ) {
			$text = '<a href="' . esc_url( $link ) . '">' . $text . '</a>';
		}
		$align = sanitize_html_class( $props['align'] ?? 'left' );
		return self::wrap( $node, $ctx, $tag, $text, [ 'class' => 'm-heading m-align-' . $align . ' m-role-' . $tag ] );
	}

	public static function paragraph( array $node, array $props, string $children, RenderContext $ctx ): string {
		$align = sanitize_html_class( $props['align'] ?? 'left' );
		$text  = nl2br( self::prosa( $props['text'] ?? '' ) );
		return self::wrap( $node, $ctx, 'p', $text, [ 'class' => 'm-p m-align-' . $align ] );
	}

	public static function rich_text( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::wrap( $node, $ctx, 'div', \Meridian\Security\Sanitizer::richtext( (string) ( $props['html'] ?? '' ) ), [ 'class' => 'm-rich' ] );
	}

	public static function eyebrow( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::wrap( $node, $ctx, 'p', esc_html( $props['text'] ?? '' ), [ 'class' => 'm-eyebrow' ] );
	}

	public static function quote( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<p>' . self::prosa( $props['text'] ?? '' ) . '</p>';
		if ( ! empty( $props['cite'] ) ) {
			$inner .= '<cite>' . esc_html( $props['cite'] ) . '</cite>';
		}
		return self::wrap( $node, $ctx, 'blockquote', $inner, [ 'class' => 'm-quote' ] );
	}

	public static function hero( array $node, array $props, string $children, RenderContext $ctx ): string {
		$align = sanitize_html_class( $props['align'] ?? 'left' );
		$copy  = '<div class="m-hero-copy">';
		if ( ! empty( $props['eyebrow'] ) ) {
			$copy .= '<p class="m-eyebrow">' . esc_html( $props['eyebrow'] ) . '</p>';
		}
		$copy .= '<h1 class="m-hero-title m-role-h1">' . nl2br( self::prosa( $props['title'] ?? '' ) ) . '</h1>';
		if ( ! empty( $props['subtitle'] ) ) {
			$copy .= '<p class="m-hero-sub">' . nl2br( self::prosa( $props['subtitle'] ) ) . '</p>';
		}
		$btns = $props['buttons'] ?? [];
		if ( $btns ) {
			$copy .= '<div class="m-btn-row">';
			foreach ( $btns as $b ) {
				$copy .= self::btn( is_array( $b ) ? $b : [] );
			}
			$copy .= '</div>';
		}
		$copy .= '</div>';
		$media = '';
		if ( ! empty( $props['imageId'] ) ) {
			$eager = empty( $ctx->needed['hero_img'] );
			$ctx->needed['hero_img'] = true;
			$media = '<div class="m-hero-media">' . self::img( $ctx, (int) $props['imageId'], '', 'm-hero-img', 'krg-hero', $eager, 'full' ) . '</div>';
		}
		return self::wrap( $node, $ctx, 'div', $copy . $media, [ 'class' => 'm-hero m-align-' . $align ] );
	}

	public static function image( array $node, array $props, string $children, RenderContext $ctx ): string {
		$alt   = $props['alt'] ?? '';
		$fit   = sanitize_html_class( $props['objectFit'] ?? 'cover' );
		$eager = ! empty( $props['parallax'] );
		$img   = self::img( $ctx, (int) ( $props['imageId'] ?? 0 ), $alt, 'm-img is-fit-' . $fit, 'large', $eager );
		$r     = sanitize_html_class( $props['radius'] ?? 'none' );
		if ( ! in_array( $r, [ 'none', 'sm', 'md', 'lg', 'full' ], true ) ) {
			$r = 'none';
		}
		$class = 'm-figure is-radius-' . $r;
		$img_scale = max( 10, min( 200, absint( $props['scale'] ?? 100 ) ) );
		$style     = '';
		if ( $img_scale !== 100 ) {
			$class .= ' is-scale';
			$style  = '--m-img-scale:' . $img_scale . '%';
		}
		if ( ( $props['fillMode'] ?? '' ) === 'fill' ) {
			$class .= ' is-fill';
		}
		$attrs = [ 'class' => $class ];

		// Cabecera adaptativa: la sección declara qué color de texto necesita
		// la cabecera cuando pasa por encima. `auto` lo deduce del fondo.
		$skin = sanitize_key( (string) ( $props['headerSkin'] ?? 'auto' ) );
		if ( 'auto' === $skin ) {
			$skin = \Meridian\Design\Contrast::for_color( $node['styles']['desktop']['background-color'] ?? null );
		}
		if ( in_array( $skin, [ 'light', 'dark' ], true ) ) {
			$attrs['data-header-skin'] = $skin;
		}
		if ( $style ) {
			$attrs['style'] = $style;
		}
		if ( ! empty( $props['parallax'] ) ) {
			$attrs['class'] = $class;
			$attrs          = self::parallax_attrs( $props, $attrs );
			$class          = $attrs['class'];
		}
		if ( ! empty( $props['centerOnMobile'] ) ) {
			$class .= ' m-img-center-m';
		}
		$align = sanitize_html_class( $node['styles']['desktop']['text-align'] ?? '' );
		if ( $align ) {
			$class .= ' m-align-' . $align;
		}
		$inner = $img;
		$full  = $props['imageUrl'] ?? '';
		if ( ! $full && ! empty( $props['imageId'] ) ) {
			$full = wp_get_attachment_image_url( (int) $props['imageId'], 'full' ) ?: '';
		}
		$href = $props['link'] ?? '';
		if ( ! empty( $props['lightbox'] ) && $full ) {
			$inner = '<a class="js-krg-lightbox" href="' . esc_url( $full ) . '">' . $inner . '</a>';
		} elseif ( $href ) {
			$tgt   = ( $props['linkTarget'] ?? '_self' ) === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
			$inner = '<a href="' . esc_url( $href ) . '"' . $tgt . '>' . $inner . '</a>';
		}
		$attrs['class'] = $class;
		return self::wrap( $node, $ctx, 'figure', $inner, $attrs );
	}

	public static function gallery( array $node, array $props, string $children, RenderContext $ctx ): string {
		$slides = [];
		if ( ! empty( $props['items'] ) && is_array( $props['items'] ) ) {
			foreach ( $props['items'] as $it ) {
				$id = absint( $it['imageId'] ?? 0 );
				if ( $id ) {
					$slides[] = [ 'id' => $id, 'alt' => (string) ( $it['alt'] ?? '' ) ];
				}
			}
		}
		if ( ! $slides && ! empty( $props['ids'] ) ) {
			foreach ( array_filter( array_map( 'absint', explode( ',', (string) $props['ids'] ) ) ) as $id ) {
				$slides[] = [ 'id' => $id, 'alt' => '' ];
			}
		}
		$layout = ( $props['layout'] ?? 'carousel' ) === 'grid' ? 'grid' : 'carousel';
		$fit    = sanitize_html_class( $props['objectFit'] ?? 'cover' );
		if ( 'carousel' === $layout ) {
			$fit = 'cover';
		}
		$h      = max( 120, min( 900, absint( $props['height'] ?? 420 ) ) );
		$ht     = max( 120, min( $h, 360 ) );
		$hm     = max( 120, min( $h, 240 ) );
		$class  = 'm-gallery is-' . $layout . ' is-fit-' . $fit;
		if ( ! empty( $props['fullWidth'] ) ) {
			$class .= ' is-full';
			$adapt  = ! array_key_exists( 'adaptSmall', $props ) || false !== $props['adaptSmall'];
			$class .= $adapt ? ' is-adapt' : ' is-full-sm';
		}
		$style = '--m-gal-h:' . $h . 'px;--m-gal-h-t:' . $ht . 'px;--m-gal-h-m:' . $hm . 'px';
		$attrs = [
			'class'    => $class,
			'style'    => $style,
			'tabindex' => '0',
		];
		$attrs = self::parallax_attrs( $props, $attrs );
		if ( 'carousel' === $layout ) {
			$attrs['data-gallery'] = '1';
			$attrs['data-keys']    = ( ! isset( $props['keyboard'] ) || ! empty( $props['keyboard'] ) ) ? '1' : '0';
			if ( ! empty( $props['autoplay'] ) ) {
				$attrs['data-autoplay'] = (string) max( 1500, absint( $props['interval'] ?? 5000 ) );
			}
		}
		if ( ! $slides ) {
			$empty = '<p class="m-muted">' . esc_html__( 'Añade imágenes a la galería.', 'meridian' ) . '</p>';
			return self::wrap( $node, $ctx, 'div', $empty, $attrs );
		}
		if ( 'grid' === $layout ) {
			// Cuántas caben por fila decide cuánto ocupa cada foto, y de
			// ahí sale el archivo que se baja el navegador.
			$cols          = max( 1, min( 6, absint( $props['desktop'] ?? 3 ) ?: 3 ) );
			$papel_rejilla = $cols >= 4 ? 'quarter' : ( $cols >= 3 ? 'third' : ( $cols >= 2 ? 'half' : 'wide' ) );
			$inner = '<div class="m-grid">';
			foreach ( $slides as $s ) {
				$inner .= '<figure class="m-figure">' . self::img( $ctx, $s['id'], $s['alt'], 'm-img', 'large', false, $papel_rejilla ) . '</figure>';
			}
			$inner .= '</div>';
			return self::wrap( $node, $ctx, 'div', $inner, $attrs );
		}
		$inner = '<div class="m-gallery-viewport"><div class="m-gallery-track">';
		foreach ( $slides as $i => $s ) {
			$on     = 0 === $i ? ' is-on' : '';
			$inner .= '<figure class="m-gallery-slide' . $on . '">' . self::img( $ctx, $s['id'], $s['alt'], 'm-img', 'large', 0 === $i ) . '</figure>';
		}
		$inner .= '</div></div>';
		$arrows = ! isset( $props['arrows'] ) || ! empty( $props['arrows'] );
		if ( $arrows && count( $slides ) > 1 ) {
			$chev_l = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			$chev_r = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
			$inner .= '<button type="button" class="m-gallery-nav m-gallery-prev" aria-label="' . esc_attr__( 'Anterior', 'meridian' ) . '">' . $chev_l . '</button>';
			$inner .= '<button type="button" class="m-gallery-nav m-gallery-next" aria-label="' . esc_attr__( 'Siguiente', 'meridian' ) . '">' . $chev_r . '</button>';
		}
		if ( count( $slides ) > 1 ) {
			$inner .= '<div class="m-gallery-dots" role="tablist">';
			foreach ( $slides as $i => $s ) {
				$on     = 0 === $i ? ' is-on' : '';
				$inner .= '<button type="button" class="m-gallery-dot' . $on . '" data-i="' . $i . '" aria-label="' . esc_attr( sprintf( __( 'Imagen %d', 'meridian' ), $i + 1 ) ) . '"></button>';
			}
			$inner .= '</div>';
		}
		return self::wrap( $node, $ctx, 'div', $inner, $attrs );
	}

	public static function video( array $node, array $props, string $children, RenderContext $ctx ): string {
		$src_mode = ( $props['source'] ?? 'link' ) === 'upload' ? 'upload' : 'link';
		$file     = '';
		if ( 'upload' === $src_mode ) {
			$file = (string) ( $props['videoUrl'] ?? '' );
			if ( ! $file && ! empty( $props['videoId'] ) ) {
				$file = wp_get_attachment_url( (int) $props['videoId'] ) ?: '';
			}
		}
		$link = (string) ( $props['url'] ?? '' );
		$url  = 'upload' === $src_mode ? $file : $link;
		if ( ! $url && $file ) {
			$url = $file;
		}
		$size = sanitize_html_class( (string) ( $props['sizeMode'] ?? 'auto' ) );
		if ( ! in_array( $size, [ 'auto', 'full', 'fullWidth', 'fullHeight', 'custom' ], true ) ) {
			$size = 'auto';
		}
		$fit = ( $props['fit'] ?? 'cover' ) === 'contain' ? 'contain' : 'cover';
		$w   = max( 0, (int) ( $props['width'] ?? 100 ) );
		$h   = max( 80, min( 1200, (int) ( $props['height'] ?? 420 ) ) );
		$vol = max( 0, min( 100, (int) ( $props['volume'] ?? 0 ) ) );
		$auto = ! empty( $props['autoplay'] ) || ! isset( $props['autoplay'] );
		$loop = ! empty( $props['loop'] ) || ! isset( $props['loop'] );
		$class = 'm-video is-' . $size . ' is-fit-' . $fit;
		$style = '--m-vid-h:' . $h . 'px;--m-vid-w:' . $w . ( 'custom' === $size ? 'px' : '%' );
		$attrs = [
			'class'       => $class,
			'style'       => $style,
			'data-video'  => '1',
			'data-volume' => (string) $vol,
		];
		if ( ! $url ) {
			return self::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Añade un enlace o sube un video.', 'meridian' ) . '</p>', $attrs );
		}
		$yt = '';
		if ( preg_match( '#(?:youtube(?:-nocookie)?\.com/(?:embed/|shorts/|watch\?(?:.*&)?v=)|youtu\.be/)([A-Za-z0-9_-]{6,})#i', $url, $m ) ) {
			$yt = $m[1];
		}
		$vm = '';
		if ( ! $yt && preg_match( '#vimeo\.com/(?:video/)?(\d+)#i', $url, $m ) ) {
			$vm = $m[1];
		}
		$mute = true;
		$ui   = self::video_ui( $vol );
		$attrs['data-autoplay'] = $auto ? '1' : '0';
		$attrs['class']        .= ' is-muted';
		if ( $yt ) {
			$q = [
				'controls'       => '0',
				'modestbranding' => '1',
				'rel'            => '0',
				'disablekb'      => '1',
				'fs'             => '0',
				'iv_load_policy' => '3',
				'playsinline'    => '1',
				'autoplay'       => $auto ? '1' : '0',
				'mute'           => '1',
				'loop'           => $loop ? '1' : '0',
			];
			if ( $loop ) {
				$q['playlist'] = $yt;
			}
			$src   = 'https://www.youtube-nocookie.com/embed/' . rawurlencode( $yt ) . '?' . http_build_query( $q );
			$inner = '<div class="m-video-frame"><iframe src="' . esc_url( $src ) . '" title="" allow="autoplay; encrypted-media" tabindex="-1"></iframe></div>' . $ui;
			return self::wrap( $node, $ctx, 'div', $inner, $attrs );
		}
		if ( $vm ) {
			$src   = 'https://player.vimeo.com/video/' . rawurlencode( $vm ) . '?background=1&autoplay=' . ( $auto ? '1' : '0' ) . '&muted=1&loop=' . ( $loop ? '1' : '0' ) . '&controls=0';
			$inner = '<div class="m-video-frame"><iframe src="' . esc_url( $src ) . '" title="" allow="autoplay" tabindex="-1"></iframe></div>' . $ui;
			return self::wrap( $node, $ctx, 'div', $inner, $attrs );
		}
		$file_url = esc_url( $url );
		$vattr    = ' playsinline webkit-playsinline disablepictureinpicture controlslist="nodownload nofullscreen noremoteplayback" preload="auto" muted';
		if ( $auto ) {
			$vattr .= ' autoplay';
		}
		if ( $loop ) {
			$vattr .= ' loop';
		}
		$inner = '<video src="' . $file_url . '"' . $vattr . '></video>' . $ui;
		return self::wrap( $node, $ctx, 'div', $inner, $attrs );
	}

	private static function video_ui( int $vol ): string {
		$vol = max( 0, min( 100, $vol ) );
		$shown = $vol > 0 ? $vol : 70;
		return '<div class="m-video-ui" data-video-ui>'
			. '<button type="button" class="m-video-mute" data-video-mute aria-pressed="true" aria-label="' . esc_attr__( 'Activar sonido', 'meridian' ) . '">'
			. '<svg class="m-video-ic-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>'
			. '<svg class="m-video-ic-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12"/></svg>'
			. '</button>'
			. '<label class="m-video-vol"><span class="screen-reader-text">' . esc_html__( 'Volumen', 'meridian' ) . '</span>'
			. '<input type="range" min="0" max="100" value="' . esc_attr( (string) $shown ) . '" data-video-vol></label>'
			. '</div>';
	}

	public static function button( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::wrap( $node, $ctx, 'div', self::btn( $props ), [ 'class' => 'm-btn-wrap' ] );
	}

	public static function button_group( array $node, array $props, string $children, RenderContext $ctx ): string {
		$align = sanitize_html_class( $props['align'] ?? 'left' );
		return self::wrap( $node, $ctx, 'div', $children, [ 'class' => 'm-btn-row m-align-' . $align ] );
	}

	public static function card( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner  = '';
		if ( ! empty( $props['imageId'] ) ) {
			$inner .= self::img( $ctx, (int) $props['imageId'], '', 'm-card-img', 'krg-card' );
		}
		$inner .= '<div class="m-card-body">';
		$inner .= '<h3 class="m-role-h3">' . esc_html( $props['title'] ?? '' ) . '</h3>';
		$inner .= '<p>' . self::prosa( $props['text'] ?? '' ) . '</p>';
		$inner .= '</div>';
		if ( ! empty( $props['url'] ) ) {
			$inner = '<a class="m-card-link" href="' . esc_url( $props['url'] ) . '">' . $inner . '</a>';
		}
		return self::wrap( $node, $ctx, 'article', $inner, [ 'class' => 'm-card' ] );
	}

	public static function cards_grid( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<div class="m-grid">';
		foreach ( $props['items'] ?? [] as $item ) {
			$fake = [ 'id' => ( $node['id'] ?? 'c' ) . '_i' . wp_generate_uuid4(), 'type' => 'card' ];
			$inner .= self::card( $fake, is_array( $item ) ? $item : [], '', $ctx );
		}
		$inner .= '</div>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function feature( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner  = '<div class="m-feature-icon" aria-hidden="true">' . esc_html( $props['icon'] ?? '' ) . '</div>';
		$inner .= '<h3 class="m-role-h3">' . esc_html( $props['title'] ?? '' ) . '</h3>';
		$inner .= '<p>' . self::prosa( $props['text'] ?? '' ) . '</p>';
		return self::wrap( $node, $ctx, 'article', $inner, [ 'class' => 'm-feature' ] );
	}

	public static function feature_grid( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<div class="m-grid">';
		foreach ( $props['items'] ?? [] as $item ) {
			$inner .= '<article class="m-feature"><div class="m-feature-icon" aria-hidden="true">' . esc_html( $item['icon'] ?? '' ) . '</div>';
			$inner .= '<h3 class="m-role-h3">' . esc_html( $item['title'] ?? '' ) . '</h3>';
			$inner .= '<p>' . self::prosa( $item['text'] ?? '' ) . '</p></article>';
		}
		$inner .= '</div>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function testimonials( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<div class="m-grid">';
		foreach ( $props['items'] ?? [] as $item ) {
			$inner .= '<blockquote class="m-quote m-card"><p>' . self::prosa( $item['text'] ?? '' ) . '</p>';
			if ( ! empty( $item['cite'] ) ) {
				$inner .= '<cite>' . esc_html( $item['cite'] ) . '</cite>';
			}
			$inner .= '</blockquote>';
		}
		$inner .= '</div>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function faq( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::accordion( $node, $props, $children, $ctx );
	}

	public static function accordion( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '';
		$i     = 0;
		foreach ( $props['items'] ?? [] as $item ) {
			++$i;
			$id = sanitize_html_class( ( $node['id'] ?? 'acc' ) . '-' . $i );
			$inner .= '<details class="m-acc"><summary>' . esc_html( $item['q'] ?? '' ) . '</summary>';
			$inner .= '<div class="m-acc-body">' . self::prosa_br( $item['a'] ?? '' ) . '</div></details>';
		}
		return self::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-accordion' ] );
	}

	public static function tabs( array $node, array $props, string $children, RenderContext $ctx ): string {
		$tabs = '';
		$pans = '';
		$i    = 0;
		foreach ( $props['items'] ?? [] as $item ) {
			++$i;
			$id      = sanitize_html_class( ( $node['id'] ?? 'tab' ) . '-' . $i );
			$selected = 1 === $i ? 'true' : 'false';
			$hidden   = 1 === $i ? '' : ' hidden';
			$tabs    .= '<button type="button" class="m-tab" role="tab" aria-selected="' . $selected . '" aria-controls="' . $id . '" id="' . $id . '-tab">' . esc_html( $item['q'] ?? '' ) . '</button>';
			$pans    .= '<div class="m-tab-panel" role="tabpanel" id="' . $id . '"' . $hidden . '>' . self::prosa_br( $item['a'] ?? '' ) . '</div>';
		}
		$inner = '<div class="m-tablist" role="tablist">' . $tabs . '</div>' . $pans;
		return self::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-tabs' ] );
	}

	public static function statistics( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<div class="m-grid m-stats">';
		foreach ( $props['items'] ?? [] as $item ) {
			$inner .= '<div class="m-stat"><div class="m-stat-value">' . esc_html( $item['q'] ?? '' ) . '</div>';
			$inner .= '<div class="m-stat-label">' . esc_html( $item['a'] ?? '' ) . '</div></div>';
		}
		$inner .= '</div>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function timeline( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<ol class="m-timeline">';
		foreach ( $props['items'] ?? [] as $item ) {
			$inner .= '<li><strong>' . esc_html( $item['q'] ?? '' ) . '</strong><p>' . self::prosa( $item['a'] ?? '' ) . '</p></li>';
		}
		$inner .= '</ol>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function cta( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner  = '<h2 class="m-role-h2">' . esc_html( $props['title'] ?? '' ) . '</h2>';
		$inner .= '<p>' . self::prosa( $props['subtitle'] ?? '' ) . '</p>';
		$inner .= self::btn(
			[
				'text'    => $props['text'] ?? __( 'Contactar', 'meridian' ),
				'url'     => $props['url'] ?? '#',
				'variant' => 'primary',
			]
		);
		return self::wrap( $node, $ctx, 'div', $inner, [ 'class' => 'm-cta' ] );
	}

	/**
	 * Una opcion de una lista cerrada, con valor de respaldo.
	 */
	private static function pick( $valor, array $validas, string $def ): string {
		$v = is_string( $valor ) ? $valor : '';
		return in_array( $v, $validas, true ) ? $v : $def;
	}

	/**
	 * Como se ven las tarjetas de una rejilla de entradas.
	 *
	 * La parte de color, fusion, logo, cita y alto es la misma que la
	 * de las colecciones: la lee `BrandRenders::card_skin()`. Aqui solo
	 * se anaden las columnas, la proporcion y el estilo.
	 *
	 * Devuelve [opciones de tarjeta, variables CSS, proporcion, estilo].
	 */
	private static function blog_card_setup( array $props, RenderContext $ctx ): array {
		$ratio = self::pick( $props['ratio'] ?? 'landscape', [ 'portrait', 'square', 'landscape', 'wide' ], 'landscape' );
		$style = self::pick( $props['cardStyle'] ?? 'stacked', [ 'stacked', 'overlay', 'outline', 'bare', 'soft' ], 'stacked' );

		[ $opts, $vars ] = \Meridian\Render\BrandRenders::card_skin( $props, $ctx, 'h3' );

		$vars = '--m-cols:' . max( 1, min( 6, absint( $props['desktop'] ?? 3 ) ?: 3 ) ) . ';'
			. '--m-cols-t:' . max( 1, min( 4, absint( $props['tablet'] ?? 2 ) ?: 2 ) ) . ';'
			. '--m-cols-m:' . max( 1, min( 3, absint( $props['mobile'] ?? 1 ) ?: 1 ) ) . ';'
			. $vars;

		return [ $opts, $vars, $ratio, $style ];
	}

	/** Las entradas que pinta una rejilla, ya consultadas. */
	private static function blog_cards( array $props, RenderContext $ctx, array $posts ): string {
		[ $opts, $vars, $ratio, $style ] = self::blog_card_setup( $props, $ctx );
		// La fecha solo si se pide. Antes salia por defecto y en una
		// tarjeta con el titulo sobre la foto sobraba.
		$fecha   = ! empty( $props['showDate'] );
		$resumen = ! array_key_exists( 'showExcerpt', $props ) || ! empty( $props['showExcerpt'] );
		$cta     = trim( (string) ( $props['linkText'] ?? '' ) );

		$cards = '';
		foreach ( $posts as $p ) {
			$it = [
				'title'    => get_the_title( $p ),
				'category' => $fecha ? get_the_date( '', $p ) : '',
				'text'     => $resumen ? wp_trim_words( get_the_excerpt( $p ), 22 ) : '',
				'imageId'  => (int) get_post_thumbnail_id( $p ),
				'alt'      => '',
				'url'      => get_permalink( $p ),
				'linkText' => $cta,
				'badge'    => '',
			];
			$cards .= '<li class="m-bgrid-item">' . \Meridian\Render\BrandRenders::card( $ctx, $it, $style, $ratio, $opts ) . '</li>';
		}
		return $cards;
	}

	public static function blog_grid( array $node, array $props, string $children, RenderContext $ctx ): string {
		$q = new \WP_Query(
			[
				'post_type'      => 'post',
				'posts_per_page' => max( 1, (int) ( $props['count'] ?? 6 ) ),
				'post_status'    => 'publish',
			]
		);
		$cards = self::blog_cards( $props, $ctx, $q->posts );
		wp_reset_postdata();
		// Sin entradas no hay rejilla: una rejilla vacia seguia ocupando
		// el alto de la seccion con su relleno y se veia como una franja
		// de fondo sin nada. En el lienzo si se avisa, para saber que el
		// bloque esta puesto y le faltan entradas.
		if ( '' === $cards ) {
			return $ctx->isCanvas
				? self::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Todavía no hay entradas publicadas.', 'meridian' ) . '</p>', [ 'class' => 'is-empty' ] )
				: '';
		}
		[ , $vars ] = self::blog_card_setup( $props, $ctx );
		return self::wrap(
			$node,
			$ctx,
			'div',
			'<ul class="m-bgrid">' . $cards . '</ul>',
			[ 'style' => $vars ]
		);
	}

	public static function recent_posts( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::blog_grid( $node, $props, $children, $ctx );
	}

	public static function related_posts( array $node, array $props, string $children, RenderContext $ctx ): string {
		$post_id = get_the_ID();
		$cats    = $post_id ? wp_get_post_categories( $post_id ) : [];
		$q       = new \WP_Query(
			[
				'post_type'      => 'post',
				'posts_per_page' => max( 1, (int) ( $props['count'] ?? 3 ) ),
				'post__not_in'   => $post_id ? [ $post_id ] : [],
				'category__in'   => $cats,
			]
		);
		if ( ! $q->have_posts() ) {
			return self::blog_grid( $node, $props, $children, $ctx );
		}
		[ , $vars ] = self::blog_card_setup( $props, $ctx );
		$inner = '<ul class="m-bgrid">' . self::blog_cards( $props, $ctx, $q->posts ) . '</ul>';
		return self::wrap( $node, $ctx, 'div', $inner, [ 'style' => $vars ] );
	}

	public static function categories( array $node, array $props, string $children, RenderContext $ctx ): string {
		// El interruptor de la pantalla de Blog manda: con el apagado
		// las categorias no se le ensenan a quien visita la web. En el
		// lienzo el bloque sigue estando y se puede seleccionar, con un
		// aviso de por que no se ve fuera.
		if ( ! \Meridian\Content\BlogSettings::show_categories() ) {
			return $ctx->isCanvas
				? self::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Las categorías están ocultas en la web (interruptor en Blog).', 'meridian' ) . '</p>', [ 'class' => 'is-empty' ] )
				: '';
		}
		$cats = get_categories( [ 'hide_empty' => true ] );
		if ( ! $cats ) {
			return $ctx->isCanvas
				? self::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Todavía no hay categorías con entradas.', 'meridian' ) . '</p>', [ 'class' => 'is-empty' ] )
				: '';
		}
		$inner = '<ul class="m-cat-list">';
		foreach ( $cats as $c ) {
			$inner .= '<li><a href="' . esc_url( get_category_link( $c ) ) . '">' . esc_html( $c->name ) . '</a></li>';
		}
		$inner .= '</ul>';
		return self::wrap( $node, $ctx, 'nav', $inner );
	}

	public static function blog_post( array $node, array $props, string $children, RenderContext $ctx ): string {
		if ( ! is_singular( 'post' ) ) {
			return '';
		}
		ob_start();
		the_content();
		$content = ob_get_clean();
		return self::wrap( $node, $ctx, 'div', $content, [ 'class' => 'm-rich m-article-body' ] );
	}

	public static function contact_form( array $node, array $props, string $children, RenderContext $ctx ): string {
		$ctx->needed['form'] = true;
		$phone   = ! empty( $props['showPhone'] );
		$subject = ! empty( $props['showSubject'] );
		$message = ! array_key_exists( 'showMessage', $props ) || ! empty( $props['showMessage'] );
		$style   = ( ( $props['style'] ?? 'boxed' ) === 'underline' ) ? ' is-underline' : ' is-boxed';
		$html    = '<form class="m-form js-krg-form' . $style . '" method="post" novalidate>';
		$html   .= wp_nonce_field( 'krg_contact', 'krg_nonce', true, false );
		$html   .= '<div class="m-hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>';
		$html   .= '<label class="m-field"><span>' . esc_html__( 'Nombre', 'meridian' ) . '</span><input type="text" name="name" autocomplete="name" required></label>';
		$html   .= '<label class="m-field"><span>' . esc_html__( 'Email', 'meridian' ) . '</span><input type="email" name="email" autocomplete="email" required></label>';
		if ( $phone ) {
			$html .= '<label class="m-field"><span>' . esc_html__( 'Teléfono', 'meridian' ) . '</span><input type="tel" name="phone" autocomplete="tel"></label>';
		}
		if ( $subject ) {
			$html .= '<label class="m-field"><span>' . esc_html__( 'Asunto', 'meridian' ) . '</span><input type="text" name="subject"></label>';
		}
		if ( $message ) {
			$html .= '<label class="m-field"><span>' . esc_html__( 'Mensaje', 'meridian' ) . '</span><textarea name="message" rows="5" required></textarea></label>';
		}
		$opt_ins = is_array( $props['optIns'] ?? null ) ? $props['optIns'] : [];
		if ( $opt_ins ) {
			$html .= '<fieldset class="m-optins"><legend class="screen-reader-text">' . esc_html__( 'Suscripciones', 'meridian' ) . '</legend>';
			foreach ( $opt_ins as $i => $opt ) {
				$label = trim( (string) ( $opt['label'] ?? '' ) );
				if ( '' === $label ) {
					continue;
				}
				$req   = ! empty( $opt['required'] ) ? ' required' : '';
				$html .= '<label class="m-optin"><input type="checkbox" name="optin[]" value="' . esc_attr( $label ) . '"' . $req . '><span>' . esc_html( $label ) . '</span></label>';
			}
			$html .= '</fieldset>';
		}
		$html .= '<button class="m-btn m-btn-primary" type="submit">' . esc_html( $props['submit'] ?? __( 'Enviar', 'meridian' ) ) . '</button>';
		$html .= '<p class="m-form-msg" hidden data-success="' . esc_attr( $props['success'] ?? '' ) . '"></p>';
		$consent = trim( (string) ( $props['consent'] ?? '' ) );
		if ( '' !== $consent ) {
			$html .= '<p class="m-form-consent">' . self::prosa( $consent ) . '</p>';
		}
		$html .= '</form>';
		return self::wrap( $node, $ctx, 'div', $html );
	}

	public static function everest_form( array $node, array $props, string $children, RenderContext $ctx ): string {
		$id = absint( $props['formId'] ?? 0 );
		if ( ! $id ) {
			return self::wrap( $node, $ctx, 'div', '<p class="m-muted">' . esc_html__( 'Elige un formulario de Everest Forms.', 'meridian' ) . '</p>', [ 'class' => 'm-everest-form' ] );
		}
		$tag = shortcode_exists( 'everest_form' ) ? 'everest_form' : ( shortcode_exists( 'everest_forms' ) ? 'everest_forms' : '' );
		if ( ! $tag ) {
			return self::wrap( $node, $ctx, 'div', '<p class="m-form-error">' . esc_html__( 'El plugin Everest Forms no está activo.', 'meridian' ) . '</p>', [ 'class' => 'm-everest-form' ] );
		}
		$html = do_shortcode( '[' . $tag . ' id="' . $id . '"]' );
		if ( ! is_string( $html ) || '' === trim( wp_strip_all_tags( $html ) ) || false !== strpos( $html, '[' . $tag ) ) {
			$html = '<p class="m-muted">' . esc_html__( 'No se encontró ese formulario.', 'meridian' ) . '</p>';
		}
		return self::wrap( $node, $ctx, 'div', $html, [ 'class' => 'm-everest-form' ] );
	}

	public static function map( array $node, array $props, string $children, RenderContext $ctx ): string {
		$ctx->needed['map'] = true;
		$url    = (string) ( $props['url'] ?? '' );
		$embed  = \Meridian\Security\UrlValidator::maps_embed( $url );
		// El alto lo manda el CSS (--m-map-h), no el atributo del iframe: así
		// se puede dar en píxeles o en porcentaje de la pantalla.
		$unit = ( ( $props['heightUnit'] ?? 'px' ) === 'vh' ) ? 'svh' : 'px';
		$max  = 'px' === $unit ? 4000 : 400;
		$h    = max( 1, min( $max, absint( $props['height'] ?? 360 ) ) );
		if ( ! $embed ) {
			$msg = $url ? __( 'La URL introducida no es válida.', 'meridian' ) : __( 'Añade una URL de Google Maps.', 'meridian' );
			return self::wrap( $node, $ctx, 'div', '<p class="m-form-error">' . esc_html( $msg ) . '</p>' );
		}
		$iframe = '<iframe title="' . esc_attr__( 'Mapa', 'meridian' ) . '" src="' . esc_url( $embed )
			. '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
		return self::wrap(
			$node,
			$ctx,
			'div',
			$iframe,
			[
				'class' => 'm-map',
				'style' => '--m-map-h:' . $h . $unit,
			]
		);
	}

	public static function social_links( array $node, array $props, string $children, RenderContext $ctx ): string {
		$inner = '<ul class="m-social">';
		foreach ( $props['items'] ?? [] as $item ) {
			$inner .= '<li><a href="' . esc_url( $item['a'] ?? '#' ) . '" target="_blank" rel="noopener noreferrer">' . esc_html( $item['q'] ?? '' ) . '</a></li>';
		}
		$inner .= '</ul>';
		return self::wrap( $node, $ctx, 'nav', $inner, [ 'aria-label' => __( 'Redes sociales', 'meridian' ) ] );
	}

	public static function logo_grid( array $node, array $props, string $children, RenderContext $ctx ): string {
		$ids   = array_filter( array_map( 'absint', explode( ',', (string) ( $props['ids'] ?? '' ) ) ) );
		$inner = '<div class="m-grid m-logos">';
		foreach ( $ids as $id ) {
			$inner .= self::img( $ctx, $id, '', 'm-logo-img', 'medium', false, 'icon' );
		}
		$inner .= '</div>';
		return self::wrap( $node, $ctx, 'div', $inner );
	}

	public static function menu( array $node, array $props, string $children, RenderContext $ctx ): string {
		$slug = sanitize_key( $props['slug'] ?? 'header' );
		$html = \Meridian\Navigation\Menus::render( $slug );
		$d    = \Meridian\Navigation\Menus::nav_mode( $props['navModeDesktop'] ?? 'bar', 'bar' );
		$t    = \Meridian\Navigation\Menus::nav_mode( $props['navModeTablet'] ?? 'bar', 'bar' );
		$m    = \Meridian\Navigation\Menus::nav_mode( $props['navModeMobile'] ?? 'drawer', 'drawer' );
		$btn  = '<button class="m-nav-toggle" type="button" aria-expanded="false">' . esc_html__( 'Menú', 'meridian' ) . '</button>';
		return self::wrap(
			$node,
			$ctx,
			'nav',
			$btn . $html,
			[
				'class'      => 'm-menu',
				'aria-label' => $slug,
				'data-nav-d' => $d,
				'data-nav-t' => $t,
				'data-nav-m' => $m,
			]
		);
	}

	public static function search_form( array $node, array $props, string $children, RenderContext $ctx ): string {
		ob_start();
		get_search_form();
		$html = (string) ob_get_clean();
		return self::wrap( $node, $ctx, 'div', $html, [ 'class' => 'm-footer-search' ] );
	}

	private static function generic( array $node, array $props, string $children, RenderContext $ctx ): string {
		return self::wrap( $node, $ctx, 'div', $children );
	}
}
