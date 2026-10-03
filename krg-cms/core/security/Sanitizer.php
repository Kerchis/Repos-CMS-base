<?php
/**
 * Schema-aware sanitizer.
 *
 * @package Meridian
 */

namespace Meridian\Security;

defined( 'ABSPATH' ) || exit;

class Sanitizer {

	public static function document( array $doc ): array {
		$out = [
			'version'         => 1,
			'id'              => absint( $doc['id'] ?? 0 ),
			'type'            => sanitize_key( $doc['type'] ?? 'page' ),
			'title'           => sanitize_text_field( $doc['title'] ?? '' ),
			'slug'            => sanitize_title( $doc['slug'] ?? '' ),
			'status'          => sanitize_key( $doc['status'] ?? 'draft' ),
			'parentId'        => absint( $doc['parentId'] ?? 0 ),
			'featuredImageId' => absint( $doc['featuredImageId'] ?? 0 ),
			'seo'             => self::seo( $doc['seo'] ?? [] ),
			'settings'        => [
				'showHeader' => ! empty( $doc['settings']['showHeader'] ),
				'showFooter' => ! empty( $doc['settings']['showFooter'] ),
				'layout'     => sanitize_key( $doc['settings']['layout'] ?? 'default' ),
				'headerMenu' => sanitize_key( (string) ( $doc['settings']['headerMenu'] ?? '' ) ),
			],
			'sections'        => [],
		];
		$sections = $doc['sections'] ?? [];
		if ( count( $sections ) > 80 ) {
			$sections = array_slice( $sections, 0, 80 );
		}
		foreach ( $sections as $section ) {
			if ( is_array( $section ) ) {
				$out['sections'][] = self::node( $section, 0 );
			}
		}
		return $out;
	}

	public static function node( array $node, int $depth ): array {
		if ( $depth > 8 ) {
			return [
				'id'       => self::id( $node['id'] ?? '' ),
				'type'     => 'paragraph',
				'visible'  => true,
				'source'   => 'local',
				'props'    => [ 'text' => '' ],
				'styles'   => self::styles( [] ),
				'children' => [],
			];
		}
		$type = sanitize_key( $node['type'] ?? 'paragraph' );
		$def  = \Meridian\Components\Registry::get( $type );
		// Fondo, relleno y margen tienen un solo sitio donde vivir. Lo que
		// guardo el sistema anterior fuera de `styles` (el `background` de
		// la seccion, los `padTop`/`padBottom` de los bloques de marca) se
		// trae aqui, antes de que `props()` lo tire por no estar ya en el
		// catalogo. Es la unica copia de esta traduccion.
		$node = \Meridian\Style\BoxStyles::migrate_node( $node );
		$out  = [
			'id'       => self::id( $node['id'] ?? '' ),
			'type'     => $type,
			'name'     => sanitize_text_field( $node['name'] ?? '' ),
			'visible'  => array_key_exists( 'visible', $node ) ? (bool) $node['visible'] : true,
			'locked'   => ! empty( $node['locked'] ),
			'source'    => ( ( $node['source'] ?? 'local' ) === 'global' ) ? 'global' : 'local',
			'globalId'  => absint( $node['globalId'] ?? 0 ),
			'htmlId'    => sanitize_html_class( (string) ( $node['htmlId'] ?? '' ) ),
			'htmlClass' => implode(
				' ',
				array_filter(
					array_map(
						'sanitize_html_class',
						preg_split( '/\s+/', (string) ( $node['htmlClass'] ?? '' ) ) ?: []
					)
				)
			),
			'hiddenOn'  => [
				'desktop' => ! empty( $node['hiddenOn']['desktop'] ),
				'tablet'  => ! empty( $node['hiddenOn']['tablet'] ),
				'mobile'  => ! empty( $node['hiddenOn']['mobile'] ),
			],
			'animation'    => in_array( sanitize_key( (string) ( $node['animation'] ?? 'none' ) ), [ 'none', 'fade', 'slide', 'zoom', 'bounce', 'flip', 'rise', 'stagger' ], true ) ? sanitize_key( (string) ( $node['animation'] ?? 'none' ) ) : 'none',
			'animDuration' => max( 0, min( 3000, absint( $node['animDuration'] ?? 600 ) ) ),
			'animDelay'    => max( 0, min( 3000, absint( $node['animDelay'] ?? 0 ) ) ),
			// Leer la clave dos veces, y la segunda sin valor por defecto,
			// soltaba un aviso de PHP en cada nodo que llegaba sin ella.
			// En una instalacion con los avisos a la vista eso ensucia la
			// respuesta de la API y el guardado se cae.
			'animEasing'   => in_array( (string) ( $node['animEasing'] ?? 'ease' ), [ 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out' ], true ) ? (string) ( $node['animEasing'] ?? 'ease' ) : 'ease',
			'filters'      => self::filters( $node['filters'] ?? [] ),
			'customCss'    => self::custom_css_fields( $node['customCss'] ?? [] ),
			'attrs'        => self::html_attrs( $node['attrs'] ?? [] ),
			'props'        => [],
			'styles'       => self::styles( $node['styles'] ?? [] ),
			'children'     => [],
		];
		$props = is_array( $node['props'] ?? null ) ? $node['props'] : [];
		if ( $def ) {
			$out['props'] = self::props( $props, $def );
		} else {
			$out['props'] = array_merge( self::generic_props( $props ), self::align_props( $props ) );
		}
		$children = $node['children'] ?? [];
		if ( is_array( $children ) ) {
			if ( count( $children ) > 50 ) {
				$children = array_slice( $children, 0, 50 );
			}
			foreach ( $children as $child ) {
				if ( is_array( $child ) ) {
					$out['children'][] = self::node( $child, $depth + 1 );
				}
			}
		}
		return $out;
	}

	public static function props( array $props, array $def ): array {
		$out    = [];
		$fields = $def['fields'] ?? [];
		foreach ( $fields as $field ) {
			$key = $field['key'] ?? '';
			if ( ! $key ) {
				continue;
			}
			$out[ $key ] = self::field( $props[ $key ] ?? ( $def['defaults'][ $key ] ?? null ), $field );
		}
		if ( 'everest-form' === ( $def['slug'] ?? '' ) ) {
			$out['formId'] = absint( $props['formId'] ?? $out['formId'] ?? 0 );
		}
		return array_merge( $out, self::align_props( $props ) );
	}

	private static function align_props( array $props ): array {
		$axis = [ 'start', 'center', 'end', 'stretch' ];
		$h    = sanitize_key( (string) ( $props['alignH'] ?? 'start' ) );
		$v    = sanitize_key( (string) ( $props['alignV'] ?? 'start' ) );
		$d    = sanitize_key( (string) ( $props['distribute'] ?? 'none' ) );
		return [
			'alignH'     => in_array( $h, $axis, true ) ? $h : 'start',
			'alignV'     => in_array( $v, $axis, true ) ? $v : 'start',
			'distribute' => in_array( $d, [ 'none', 'x', 'y' ], true ) ? $d : 'none',
		];
	}

	public static function field( $value, array $field ) {
		$type = $field['type'] ?? 'text';
		switch ( $type ) {
			case 'toggle':
				return (bool) $value;
			case 'number':
				// Un numero en blanco no es un cero. Hay campos (los
				// espacios en px) donde «sin valor» significa «deja el
				// ritmo del modulo»; guardar 0 ahi aplastaba el relleno
				// por defecto y el bloque salia pegado al de arriba.
				if ( ! empty( $field['allowEmpty'] ) && ( null === $value || '' === $value ) ) {
					return '';
				}
				$n = is_numeric( $value ) ? 0 + $value : 0;
				if ( isset( $field['min'] ) ) {
					$n = max( $field['min'], $n );
				}
				if ( isset( $field['max'] ) ) {
					$n = min( $field['max'], $n );
				}
				return $n;
			case 'select':
			case 'htmlTag':
			case 'alignment':
				$opts = $field['options'] ?? [];
				$flat = [];
				foreach ( $opts as $opt ) {
					$flat[] = is_array( $opt ) ? (string) ( $opt['value'] ?? '' ) : (string) $opt;
				}
				$v = is_string( $value ) ? $value : (string) $value;
				if ( ! $flat ) {
					return is_numeric( $value ) ? 0 + $value : sanitize_text_field( $v );
				}
				if ( in_array( $v, $flat, true ) ) {
					return is_numeric( $v ) ? 0 + $v : $v;
				}
				foreach ( $flat as $opt ) {
					if ( is_numeric( $opt ) && is_numeric( $v ) && (int) $opt === (int) $v ) {
						return 0 + $opt;
					}
				}
				return $flat[0] ?? '';
			case 'mapsUrl':
				return UrlValidator::maps( (string) $value );
			case 'url':
			case 'link':
				if ( is_array( $value ) ) {
					return [
						'url'    => UrlValidator::sanitize( (string) ( $value['url'] ?? '' ) ),
						'target' => in_array( $value['target'] ?? '_self', [ '_self', '_blank' ], true ) ? $value['target'] : '_self',
						'rel'    => sanitize_text_field( $value['rel'] ?? '' ),
					];
				}
				return UrlValidator::sanitize( (string) $value );
			case 'email':
				return sanitize_email( (string) $value );
			case 'image':
				return absint( $value );
			case 'textarea':
				return sanitize_textarea_field( (string) $value );
			case 'richtext':
				return self::richtext( (string) $value );
			case 'color':
				return self::color( $value, ! empty( $field['allowEmpty'] ) );
			case 'spacing':
				return self::spacing( $value );
			case 'repeater':
				$items = is_array( $value ) ? $value : [];
				// Tope por defecto 50. Un bloque puede pedir mas (una carta
				// de restaurante no cabe en 50 platos), nunca mas de 300.
				$limit = absint( $field['maxItems'] ?? 50 );
				$limit = max( 1, min( 300, $limit ?: 50 ) );
				$items = array_slice( $items, 0, $limit );
				$sub   = $field['itemFields'] ?? [];
				$out   = [];
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$row = [];
					foreach ( $sub as $sf ) {
						$k         = $sf['key'] ?? '';
						$row[ $k ] = self::field( $item[ $k ] ?? null, $sf );
					}
					$out[] = $row;
				}
				return $out;
			case 'map':
				return [
					'url'    => UrlValidator::maps( (string) ( is_array( $value ) ? ( $value['url'] ?? '' ) : $value ) ),
					'lat'    => isset( $value['lat'] ) ? (float) $value['lat'] : null,
					'lng'    => isset( $value['lng'] ) ? (float) $value['lng'] : null,
					'zoom'   => min( 21, max( 1, absint( is_array( $value ) ? ( $value['zoom'] ?? 14 ) : 14 ) ) ),
					'height' => absint( is_array( $value ) ? ( $value['height'] ?? 360 ) : 360 ),
				];
			default:
				if ( is_array( $value ) ) {
					return self::generic_props( $value );
				}
				return sanitize_text_field( (string) $value );
		}
	}

	/**
	 * Color de una propiedad.
	 *
	 * `$optional` es «sin color»: el campo puede quedarse en blanco y
	 * entonces manda lo que diga el tema. Sin esa opcion todo campo de
	 * color ausente volvia como el color primario, asi que un campo
	 * nuevo habria pintado de primario media plantilla.
	 *
	 * El valor admite hexadecimal (#abc, #aabbcc) y variable del sistema
	 * (`var(--color-primary)`), que es justo lo que el panel enseña
	 * cuando el color viene de un token: antes `sanitize_hex_color()` lo
	 * tiraba sin avisar y el color «no se guardaba».
	 */
	public static function color( $value, bool $optional = false ): array {
		$none = [ 'mode' => 'none', 'token' => '', 'value' => '' ];
		if ( null === $value || '' === $value ) {
			return $optional ? $none : [ 'mode' => 'token', 'token' => 'color.primary' ];
		}
		if ( is_string( $value ) ) {
			if ( str_starts_with( $value, 'token:' ) ) {
				return [ 'mode' => 'token', 'token' => sanitize_text_field( substr( $value, 6 ) ) ];
			}
			$css = self::css_color( $value );
			if ( '' === $css ) {
				return $optional ? $none : [ 'mode' => 'custom', 'value' => '#000000' ];
			}
			return [ 'mode' => 'custom', 'value' => $css ];
		}
		if ( ! is_array( $value ) ) {
			return $optional ? $none : [ 'mode' => 'token', 'token' => 'color.primary' ];
		}
		$mode = ( $value['mode'] ?? 'token' ) === 'custom' ? 'custom' : 'token';
		if ( 'none' === ( $value['mode'] ?? '' ) ) {
			return $none;
		}
		$css = self::css_color( (string) ( $value['value'] ?? '' ) );
		if ( $optional && 'custom' === $mode && '' === $css ) {
			return $none;
		}
		return [
			'mode'  => $mode,
			'token' => sanitize_text_field( $value['token'] ?? ( $optional ? '' : 'color.primary' ) ),
			'value' => $css,
		];
	}

	/** Hexadecimal o variable del sistema; cualquier otra cosa se descarta. */
	public static function css_color( string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return '';
		}
		if ( preg_match( '/^var\(\s*--[A-Za-z0-9_-]+\s*\)$/', $value ) ) {
			return preg_replace( '/\s+/', '', $value );
		}
		return sanitize_hex_color( $value ) ?: '';
	}

	public static function spacing( $value ): array {
		$sides = [ 'top', 'right', 'bottom', 'left' ];
		$out   = [];
		if ( is_string( $value ) ) {
			foreach ( $sides as $s ) {
				$out[ $s ] = self::css_length( $value );
			}
			return $out;
		}
		if ( ! is_array( $value ) ) {
			return [ 'top' => '', 'right' => '', 'bottom' => '', 'left' => '' ];
		}
		foreach ( $sides as $s ) {
			$out[ $s ] = self::css_length( (string) ( $value[ $s ] ?? '' ) );
		}
		return $out;
	}

	public static function css_length( string $v ): string {
		$v = trim( $v );
		if ( $v === '' ) {
			return '';
		}
		if ( str_starts_with( $v, 'var(' ) ) {
			return \Meridian\Design\TokenCompiler::safe_css( $v );
		}
		if ( preg_match( '/^-?[0-9]+(\.[0-9]+)?(px|rem|em|%|vh|vw)?$/', $v ) ) {
			return $v;
		}
		return '';
	}

	/**
	 * Estilos de los tres tamanos.
	 *
	 * Los tamanos sin nada se DESCARTAN en vez de guardarse vacios, y la
	 * razon no es el tamano del documento: es que PHP escribe un array
	 * vacio como `[]`, que en JSON es una LISTA, no un diccionario. El
	 * panel recibia `"styles":{"desktop":[]}`, le colgaba la propiedad al
	 * array —en memoria funciona, el lienzo pintaba el color— y al
	 * guardar `JSON.stringify` descartaba las propiedades con nombre de
	 * un array: el valor se perdia entre el navegador y el servidor sin
	 * un solo error. Se veia en el lienzo, seguia en el campo del
	 * inspector y nunca llegaba a la base de datos.
	 *
	 * El navegador tambien se defiende solo ({@see builder-core.js},
	 * `dict()`), que es lo que arregla los documentos ya guardados. Esto
	 * evita crear nuevos.
	 */
	public static function styles( $styles ): array {
		$out = [];
		if ( ! is_array( $styles ) ) {
			return $out;
		}
		foreach ( [ 'desktop', 'tablet', 'mobile' ] as $k ) {
			$limpio = is_array( $styles[ $k ] ?? null ) ? self::style_props( $styles[ $k ] ) : [];
			if ( $limpio ) {
				$out[ $k ] = $limpio;
			}
		}
		return $out;
	}

	/**
	 * Estilos de un tamano.
	 *
	 * Fondo, relleno y margen los lleva {@see \Meridian\Style\BoxStyles}
	 * —claves largas, valores validados, sin atajos—. El resto
	 * (tipografia, bordes, tamanos...) sigue por la lista de siempre.
	 */
	public static function style_props( array $styles ): array {
		$box     = \Meridian\Style\BoxStyles::clean( \Meridian\Style\BoxStyles::from_legacy( $styles ) );
		$allowed = [
			'font-size', 'font-weight', 'font-family', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration',
			'color', 'text-align',
			'border-radius', 'box-shadow', 'border', 'border-color', 'border-width', 'border-style',
			'gap', 'display', 'grid-template-columns', 'order', 'max-width', 'max-height', 'min-width', 'min-height', 'width', 'height',
			'opacity', 'align-items', 'justify-content', 'flex-direction', 'object-fit', 'object-position',
			'filter', 'box-shadow', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
			'transition', 'transition-duration', 'transition-delay', 'transition-timing-function',
			'animation-duration', 'animation-delay', 'animation-timing-function',
			// Posicion y transformacion: las pide el grupo «Avanzado» del
			// inspector. Van con validacion propia mas abajo, porque aqui
			// un valor libre acaba en la hoja de estilos de la web.
			'position', 'top', 'right', 'bottom', 'left', 'z-index',
			'transform', 'transform-origin',
		];
		$out = [];
		foreach ( $styles as $prop => $val ) {
			$prop = sanitize_title( $prop );
			$prop = str_replace( '_', '-', $prop );
			if ( ! in_array( $prop, $allowed, true ) ) {
				continue;
			}
			if ( is_array( $val ) ) {
				if ( isset( $val['top'] ) ) {
					$parts = [];
					foreach ( [ 'top', 'right', 'bottom', 'left' ] as $s ) {
						$parts[] = self::css_length( (string) ( $val[ $s ] ?? '0' ) ) ?: '0';
					}
					$out[ $prop ] = implode( ' ', $parts );
				} elseif ( ( $val['mode'] ?? '' ) === 'token' ) {
					$out[ $prop ] = \Meridian\Design\TokenCompiler::token_var( (string) ( $val['token'] ?? 'color.primary' ) );
				} elseif ( ! empty( $val['value'] ) ) {
					$out[ $prop ] = \Meridian\Design\TokenCompiler::safe_css( (string) $val['value'] );
				}
			} else {
				$out[ $prop ] = \Meridian\Design\TokenCompiler::safe_css( (string) $val );
			}
			if ( isset( $out[ $prop ] ) ) {
				$limpio = self::guarded_prop( $prop, (string) $out[ $prop ] );
				if ( '' === $limpio ) {
					unset( $out[ $prop ] );
				} else {
					$out[ $prop ] = $limpio;
				}
			}
		}
		return array_merge( $out, $box );
	}

	public static function seo( $seo ): array {
		$seo = is_array( $seo ) ? $seo : [];
		$allowed_robots = [ 'index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow' ];
		$robots         = sanitize_text_field( $seo['robots'] ?? 'index,follow' );
		if ( ! in_array( $robots, $allowed_robots, true ) ) {
			$robots = 'index,follow';
		}
		return [
			'title'         => sanitize_text_field( $seo['title'] ?? '' ),
			'description'   => sanitize_textarea_field( $seo['description'] ?? '' ),
			'canonical'     => UrlValidator::sanitize( $seo['canonical'] ?? '' ),
			'ogTitle'       => sanitize_text_field( $seo['ogTitle'] ?? '' ),
			'ogDescription' => sanitize_textarea_field( $seo['ogDescription'] ?? '' ),
			'ogImageId'     => absint( $seo['ogImageId'] ?? 0 ),
			'robots'        => $robots,
		];
	}

	/**
	 * Texto con formato de un campo del panel (modulos).
	 *
	 * Lista corta a proposito: lo que cabe en un parrafo de un modulo.
	 * Para el cuerpo de un articulo del blog esta `post_content()`, que
	 * admite ademas imagenes, tablas y encabezados.
	 */
	public static function richtext( string $html ): string {
		$allowed = [
			'p'          => [],
			'br'         => [],
			'strong'     => [],
			'b'          => [],
			'em'         => [],
			'i'          => [],
			'ul'         => [],
			'ol'         => [],
			'li'         => [],
			'blockquote' => [],
			'h2'         => [],
			'h3'         => [],
			'h4'         => [],
			'a'          => [
				'href'   => true,
				'rel'    => true,
				'target' => true,
			],
		];
		return self::safe_hrefs( wp_kses( $html, $allowed ) );
	}

	/**
	 * El cuerpo de un articulo del blog.
	 *
	 * Lo escribe el editor clasico (TinyMCE) desde el panel, asi que la
	 * lista tiene que admitir lo que ese editor produce: imagenes y pies
	 * de foto del boton «Anadir multimedia», encabezados, tablas, listas,
	 * codigo y las clases de alineacion de WordPress (`alignleft`,
	 * `wp-image-123`, `size-large`…). Con la lista corta de `richtext()`
	 * una imagen insertada desaparecia sin avisar al guardar.
	 *
	 * Lo que NO entra, y es deliberado: `script`, `style`, `iframe`,
	 * `object`, `embed`, `form` y cualquier atributo `on*`. Un video de
	 * YouTube se pega como enlace y WordPress lo convierte solo (oEmbed);
	 * para incrustar un mapa esta el modulo de mapa, que tiene su propio
	 * saneador. El filtro de fondo sigue siendo `wp_kses`, que ademas
	 * limpia los protocolos (`javascript:`) de cualquier URL.
	 */
	public static function post_content( string $html ): string {
		$comun = [
			'class' => true,
			'id'    => true,
			'style' => true,
			'title' => true,
			'dir'   => true,
			'lang'  => true,
		];
		$celda = array_merge(
			$comun,
			[
				'colspan' => true,
				'rowspan' => true,
				'scope'   => true,
				'headers' => true,
			]
		);
		$allowed = [
			'p'          => $comun,
			'br'         => [],
			'hr'         => $comun,
			'strong'     => $comun,
			'b'          => $comun,
			'em'         => $comun,
			'i'          => $comun,
			'u'          => $comun,
			's'          => $comun,
			'del'        => array_merge( $comun, [ 'datetime' => true ] ),
			'ins'        => array_merge( $comun, [ 'datetime' => true ] ),
			'mark'       => $comun,
			'small'      => $comun,
			'sub'        => $comun,
			'sup'        => $comun,
			'abbr'       => array_merge( $comun, [ 'title' => true ] ),
			'code'       => $comun,
			'pre'        => $comun,
			'kbd'        => $comun,
			'span'       => $comun,
			'div'        => $comun,
			'ul'         => $comun,
			'ol'         => array_merge( $comun, [ 'start' => true, 'reversed' => true, 'type' => true ] ),
			'li'         => $comun,
			'dl'         => $comun,
			'dt'         => $comun,
			'dd'         => $comun,
			'blockquote' => array_merge( $comun, [ 'cite' => true ] ),
			'cite'       => $comun,
			'h1'         => $comun,
			'h2'         => $comun,
			'h3'         => $comun,
			'h4'         => $comun,
			'h5'         => $comun,
			'h6'         => $comun,
			'figure'     => $comun,
			'figcaption' => $comun,
			'img'        => array_merge(
				$comun,
				[
					'src'      => true,
					'alt'      => true,
					'width'    => true,
					'height'   => true,
					'srcset'   => true,
					'sizes'    => true,
					'loading'  => true,
					'decoding' => true,
				]
			),
			'a'          => array_merge(
				$comun,
				[
					'href'     => true,
					'rel'      => true,
					'target'   => true,
					'download' => true,
				]
			),
			'table'      => $comun,
			'thead'      => $comun,
			'tbody'      => $comun,
			'tfoot'      => $comun,
			'caption'    => $comun,
			'tr'         => $comun,
			'th'         => $celda,
			'td'         => $celda,
		];
		return self::safe_hrefs( wp_kses( $html, $allowed ) );
	}

	/**
	 * Revisa los `href` que hayan sobrevivido al filtro.
	 *
	 * `wp_kses` ya quita los protocolos peligrosos; esto normaliza
	 * ademas la URL con el validador del tema y deja un `#` cuando no
	 * queda nada aprovechable, para no publicar un enlace roto.
	 */
	private static function safe_hrefs( string $html ): string {
		$html = preg_replace_callback(
			'#href=(["\'])(.*?)\1#i',
			static function ( $m ) {
				$url = UrlValidator::sanitize( html_entity_decode( $m[2] ) );
				if ( $url === '' || UrlValidator::is_dangerous( $m[2] ) ) {
					return 'href=' . $m[1] . '#' . $m[1];
				}
				return 'href=' . $m[1] . esc_attr( $url ) . $m[1];
			},
			$html
		);
		return $html ?: '';
	}

	public static function id( string $id ): string {
		$id = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $id );
		if ( $id === '' ) {
			$id = 'n_' . wp_generate_uuid4();
		}
		return $id;
	}

	public static function filters( $v ): array {
		$v = is_array( $v ) ? $v : [];
		$n = static function ( $x, $min, $max, $def ) {
			if ( ! is_numeric( $x ) ) {
				return $def;
			}
			return max( $min, min( $max, 0 + $x ) );
		};
		return [
			'hue'        => $n( $v['hue'] ?? 0, 0, 360, 0 ),
			'sat'        => $n( $v['sat'] ?? 100, 0, 200, 100 ),
			'brightness' => $n( $v['brightness'] ?? 100, 0, 200, 100 ),
			'contrast'   => $n( $v['contrast'] ?? 100, 0, 200, 100 ),
			'invert'     => $n( $v['invert'] ?? 0, 0, 100, 0 ),
			'sepia'      => $n( $v['sepia'] ?? 0, 0, 100, 0 ),
		];
	}

	/**
	 * Las propiedades que no pueden llevar cualquier cosa.
	 *
	 * `safe_css()` solo quita llaves y angulos, que vale para un color o
	 * un tamaño. Para `position`, `transform` y los cuatro lados hace
	 * falta algo mas estrecho: son valores que el inspector deja escribir
	 * a mano y acaban tal cual en la hoja de la web.
	 *
	 * Devuelve el valor bueno, o cadena vacia si no vale (y entonces no
	 * se guarda: mejor que no haya nada a que haya algo raro).
	 */
	private static function guarded_prop( string $prop, string $val ): string {
		$val = trim( $val );
		if ( '' === $val ) {
			return '';
		}
		switch ( $prop ) {
			case 'position':
				return in_array( $val, [ 'static', 'relative', 'absolute', 'sticky', 'fixed' ], true ) ? $val : '';
			case 'z-index':
				return is_numeric( $val ) ? (string) max( -999, min( 999, (int) $val ) ) : '';
			case 'top':
			case 'right':
			case 'bottom':
			case 'left':
				return 'auto' === $val ? 'auto' : self::css_length( $val );
			case 'transform':
			case 'transform-origin':
				// Solo funciones y palabras de CSS: letras, numeros,
				// unidades, comas, parentesis y signos. Nada de `url(`,
				// `expression(`, comillas ni punto y coma.
				if ( preg_match( '/^[a-zA-Z0-9 .,%()+\-_\/]+$/', $val ) !== 1 ) {
					return '';
				}
				if ( preg_match( '/(url|expression|image-set|javascript)\s*\(/i', $val ) === 1 ) {
					return '';
				}
				return $val;
			default:
				return $val;
		}
	}

	/**
	 * Atributos HTML que el usuario escribe a mano en «Avanzado».
	 *
	 * Sirven para enganchar analitica, accesibilidad o librerias de
	 * terceros sin tocar codigo. Como van directos a la etiqueta, la
	 * lista es cerrada: `data-*`, `aria-*` y un puñado de atributos de
	 * HTML que no cambian el comportamiento del documento.
	 *
	 * Lo que NUNCA pasa: `on*` (un `onclick` es ejecutar codigo ajeno),
	 * `style`, `class` e `id` (los pone el CMS y los gestiona el panel),
	 * y `src`/`href` (cargar o enlazar a cualquier sitio desde un
	 * atributo suelto). Maximo 20 por bloque.
	 *
	 * @param mixed $v Lista de { key, value } o mapa clave => valor.
	 */
	public static function html_attrs( $v ): array {
		$permitidos = [ 'title', 'role', 'lang', 'dir', 'tabindex', 'itemprop', 'itemtype', 'itemscope', 'translate', 'draggable', 'hidden' ];
		$pares      = [];
		if ( is_array( $v ) ) {
			foreach ( $v as $k => $item ) {
				if ( is_array( $item ) ) {
					$pares[] = [ (string) ( $item['key'] ?? '' ), (string) ( $item['value'] ?? '' ) ];
				} else {
					$pares[] = [ (string) $k, (string) $item ];
				}
			}
		}
		$out = [];
		foreach ( $pares as [ $clave, $valor ] ) {
			$clave = strtolower( trim( $clave ) );
			if ( '' === $clave || count( $out ) >= 20 ) {
				continue;
			}
			$bueno = preg_match( '/^(data|aria)-[a-z0-9][a-z0-9_-]*$/', $clave ) === 1
				|| in_array( $clave, $permitidos, true );
			if ( ! $bueno ) {
				continue;
			}
			$valor = sanitize_text_field( $valor );
			// Un `javascript:` o un `data:` dentro del valor no tiene
			// sentido en estos atributos y si lo tiene en un ataque.
			if ( preg_match( '/^\s*(javascript|data|vbscript)\s*:/i', $valor ) === 1 ) {
				continue;
			}
			$out[ $clave ] = $valor;
		}
		return $out;
	}

	public static function custom_css_fields( $v ): array {
		$v = is_array( $v ) ? $v : [];
		$clean = static function ( $css ) {
			$css = (string) $css;
			$css = str_ireplace( [ '</', 'javascript', 'expression', '@import', 'behavior', 'url(' ], '', $css );
			$css = preg_replace( '/[<>]/', '', $css );
			return trim( (string) $css );
		};
		return [
			'before' => $clean( $v['before'] ?? '' ),
			'main'   => $clean( $v['main'] ?? '' ),
			'after'  => $clean( $v['after'] ?? '' ),
		];
	}

	private static function generic_props( array $props ): array {
		$out = [];
		foreach ( $props as $k => $v ) {
			$key = sanitize_key( (string) $k );
			if ( is_bool( $v ) ) {
				$out[ $key ] = $v;
			} elseif ( is_numeric( $v ) ) {
				$out[ $key ] = 0 + $v;
			} elseif ( is_array( $v ) ) {
				$out[ $key ] = self::generic_props( $v );
			} else {
				$out[ $key ] = sanitize_text_field( (string) $v );
			}
		}
		return $out;
	}
}
