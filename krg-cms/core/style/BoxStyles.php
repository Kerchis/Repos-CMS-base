<?php
/**
 * Fondo, relleno y margen: una sola fuente de verdad.
 *
 * Antes habia cuatro sistemas distintos peleando por estas tres
 * propiedades, y por eso no habia forma de predecir cual ganaba:
 *
 *   1. `props.background` de la seccion (con valor por defecto), que
 *      `section()` escribia en el atributo `style`.
 *   2. `styles[bp].background` del panel «Fondo», que se escribia otra vez
 *      en el mismo atributo, detras, para ganarle al anterior.
 *   3. `props.padTop` / `props.padBottom` de los bloques de marca, que
 *      viajaban como `--m-pad-top` / `--m-pad-bottom` y los consumia un
 *      `padding-block` del CSS del tema.
 *   4. `styles[bp].padding` (atajo) y `styles[bp].padding-top` (largo),
 *      que podian existir a la vez y contradecirse.
 *
 * Y encima se emitian por tres caminos (atributo en linea, hoja del
 * documento con `!important`, y un tercer generador en JavaScript para el
 * lienzo), cada uno con sus propias reglas.
 *
 * Aqui vive el sistema entero, una sola vez:
 *
 *   - QUE se puede poner: {@see self::PROPS}, solo propiedades largas.
 *   - DONDE vive: `node['styles'][breakpoint][propiedad]`, nada mas.
 *   - COMO se escribe en CSS: {@see self::rule()}, sin `!important`.
 *   - QUE hacer con lo viejo: {@see self::migrate_document()}.
 *
 * @package Meridian
 */

namespace Meridian\Style;

defined( 'ABSPATH' ) || exit;

class BoxStyles {

	/**
	 * Las unicas claves que maneja este sistema. Largas a proposito: con
	 * atajos (`padding: 10px 20px`) hay que decidir quien gana cuando
	 * conviven con una propiedad larga, y esa decision es justo la clase
	 * de regla invisible que hacia que el panel pareciera roto.
	 */
	public const PROPS = [
		'background-color',
		'padding-top',
		'padding-right',
		'padding-bottom',
		'padding-left',
		'margin-top',
		'margin-right',
		'margin-bottom',
		'margin-left',
	];

	/** Lados, en el orden de los atajos CSS. */
	private const SIDES = [ 'top', 'right', 'bottom', 'left' ];

	/** Los tres tamanos, de mas ancho a mas estrecho. */
	public const BREAKPOINTS = [ 'desktop', 'tablet', 'mobile' ];

	/**
	 * Un valor de medida que se puede escribir tal cual en el CSS.
	 *
	 * Deja pasar lo que sirve para separar («120px», «0», «4rem», «10%»,
	 * «auto») y nada mas. No transforma: si no vale, no entra.
	 */
	public static function length( $value ): string {
		$v = strtolower( trim( (string) $value ) );
		if ( '' === $v ) {
			return '';
		}
		if ( 'auto' === $v || '0' === $v ) {
			return $v;
		}
		return preg_match( '/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|svh|dvh)$/', $v ) ? $v : '';
	}

	/** Un color escribible: hexadecimal, token del sistema o rgb(). */
	public static function color( $value ): string {
		if ( is_array( $value ) ) {
			$mode = (string) ( $value['mode'] ?? '' );
			if ( 'none' === $mode ) {
				return '';
			}
			if ( 'token' === $mode && ! empty( $value['token'] ) ) {
				return \Meridian\Design\TokenCompiler::token_var( (string) $value['token'] );
			}
			$value = (string) ( $value['value'] ?? '' );
		}
		$v = trim( (string) $value );
		if ( '' === $v ) {
			return '';
		}
		if ( preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $v ) ) {
			return strtolower( $v );
		}
		if ( preg_match( '/^var\(--[a-z0-9-]+\)$/i', $v ) ) {
			return $v;
		}
		if ( preg_match( '/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i', $v ) ) {
			return $v;
		}
		return '';
	}

	/**
	 * Deja un mapa de estilos de un tamano con solo claves de este
	 * sistema, validadas. Lo que no valga desaparece: media verdad guardada
	 * es lo que hace que el panel ensene un valor que la pagina no tiene.
	 */
	public static function clean( array $styles ): array {
		$out = [];
		foreach ( self::PROPS as $prop ) {
			if ( ! array_key_exists( $prop, $styles ) ) {
				continue;
			}
			$val = 'background-color' === $prop
				? self::color( $styles[ $prop ] )
				: self::length( $styles[ $prop ] );
			if ( '' !== $val ) {
				$out[ $prop ] = $val;
			}
		}
		return $out;
	}

	/**
	 * Traduce lo guardado por el sistema viejo al nuevo.
	 *
	 * Se aplica al leer y al guardar, asi que una pagina hecha con la
	 * version anterior se ve igual sin que nadie tenga que tocarla, y en
	 * cuanto se guarde queda escrita ya en el formato nuevo. Lo nuevo
	 * manda siempre: si ya hay `padding-top`, el atajo viejo se ignora en
	 * vez de pelear con el.
	 */
	public static function from_legacy( array $styles ): array {
		$out = $styles;

		// `background` (podia ser color, token o un objeto del selector).
		if ( isset( $out['background'] ) && ! isset( $out['background-color'] ) ) {
			$c = self::color( $out['background'] );
			if ( '' !== $c ) {
				$out['background-color'] = $c;
			}
		}
		unset( $out['background'] );

		// Atajos de cuatro lados.
		foreach ( [ 'padding', 'margin' ] as $kind ) {
			if ( ! isset( $out[ $kind ] ) ) {
				continue;
			}
			foreach ( self::expand( (string) $out[ $kind ] ) as $side => $val ) {
				$key = $kind . '-' . $side;
				if ( ! isset( $out[ $key ] ) && '' !== $val ) {
					$out[ $key ] = $val;
				}
			}
			unset( $out[ $kind ] );
		}

		return $out;
	}

	/** «10px 20px» → top/right/bottom/left, como lo haria el navegador. */
	public static function expand( string $shorthand ): array {
		$parts = preg_split( '/\s+/', trim( $shorthand ) ) ?: [];
		$parts = array_values( array_filter( $parts, static fn( $p ) => '' !== $p ) );
		$n     = count( $parts );
		if ( ! $n ) {
			return [];
		}
		$map = [
			'top'    => $parts[0],
			'right'  => $parts[ $n > 1 ? 1 : 0 ],
			'bottom' => $parts[ $n > 2 ? 2 : 0 ],
			'left'   => $parts[ $n > 3 ? 3 : ( $n > 1 ? 1 : 0 ) ],
		];
		return array_map( [ self::class, 'length' ], $map );
	}

	/**
	 * Un nodo entero: recoge lo que el sistema viejo guardaba fuera de
	 * `styles` y lo mete donde vive ahora.
	 *
	 * `props.background` traia un valor por defecto («el fondo del tema»)
	 * en todas las secciones. Ese no se migra: no lo eligio nadie, y
	 * copiarlo dejaria todas las secciones con un color escrito a mano que
	 * luego hay que borrar a mano. El `body` ya pinta ese mismo color.
	 */
	public static function migrate_node( array $node ): array {
		$styles = is_array( $node['styles'] ?? null ) ? $node['styles'] : [];
		foreach ( self::BREAKPOINTS as $bp ) {
			$styles[ $bp ] = self::from_legacy( is_array( $styles[ $bp ] ?? null ) ? $styles[ $bp ] : [] );
		}
		$props = is_array( $node['props'] ?? null ) ? $node['props'] : [];

		if ( isset( $props['background'] ) && ! isset( $styles['desktop']['background-color'] ) ) {
			$bg      = $props['background'];
			$default = is_array( $bg ) && 'token' === ( $bg['mode'] ?? '' ) && 'color.background' === ( $bg['token'] ?? '' );
			$c       = $default ? '' : self::color( $bg );
			if ( '' !== $c ) {
				$styles['desktop']['background-color'] = $c;
			}
		}
		unset( $props['background'] );

		foreach ( [ 'padTop' => 'padding-top', 'padBottom' => 'padding-bottom' ] as $old => $new ) {
			if ( isset( $props[ $old ] ) && '' !== $props[ $old ] && ! isset( $styles['desktop'][ $new ] ) ) {
				$len = self::length( (string) (int) $props[ $old ] . 'px' );
				if ( '' !== $len ) {
					$styles['desktop'][ $new ] = $len;
				}
			}
			unset( $props[ $old ] );
		}

		$node['styles'] = $styles;
		$node['props']  = $props;
		if ( ! empty( $node['children'] ) && is_array( $node['children'] ) ) {
			$node['children'] = array_map( [ self::class, 'migrate_node' ], $node['children'] );
		}
		return $node;
	}

	/** Lo mismo para un documento completo. */
	public static function migrate_document( array $doc ): array {
		if ( ! empty( $doc['sections'] ) && is_array( $doc['sections'] ) ) {
			$doc['sections'] = array_map( [ self::class, 'migrate_node' ], $doc['sections'] );
		}
		return $doc;
	}

	/**
	 * Las declaraciones de un tamano, listas para una regla.
	 *
	 * Sin `!important`: la hoja del documento se carga la ultima, asi que
	 * a igualdad de especificidad gana, y lo que el tema trae por defecto
	 * esta envuelto en `:where()` para no competir. Si algo le gana, es
	 * que hay una regla mas fuerte de verdad, y eso hay que verlo, no
	 * taparlo.
	 */
	public static function declarations( array $styles ): array {
		$out = [];
		foreach ( self::clean( $styles ) as $prop => $val ) {
			$out[] = $prop . ':' . $val;
		}
		return $out;
	}

	/** Una regla CSS para un selector y un tamano. Cadena vacia si no hay nada. */
	public static function rule( string $selector, array $styles ): string {
		$decls = self::declarations( $styles );
		return $decls ? $selector . '{' . implode( ';', $decls ) . '}' : '';
	}
}
