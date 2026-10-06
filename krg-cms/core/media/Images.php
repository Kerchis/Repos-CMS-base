<?php
/**
 * Las fotos de la web, en un solo sitio.
 *
 * Tres cosas que antes no estaban y que se notan al cargar:
 *
 *   1. **`sizes` que no miente.** Hasta ahora todas las fotos decían lo
 *      mismo: «ocupo 1200 px». Daba igual que fuera el fondo de una
 *      portada o el icono de una marquesina de 48 px: el navegador se
 *      bajaba el archivo grande para las dos. Ahora cada foto dice lo
 *      que de verdad ocupa según dónde esté puesta, y el navegador
 *      elige del `srcset` el archivo que toca.
 *   2. **Formatos modernos.** Si la foto tiene hermanas en WebP o AVIF
 *      —las prepara `Formats`—, sale dentro de un `<picture>` con esas
 *      versiones delante y el JPEG o el PNG detrás, de respaldo. El
 *      navegador que entienda el formato nuevo se baja la mitad de
 *      bytes; el que no, se baja lo de siempre.
 *   3. **Alto y ancho siempre.** Sin `width` y `height` el navegador no
 *      sabe cuánto hueco reservar y la página pega un salto cuando la
 *      foto llega: eso es el CLS. Aquí se ponen aunque los metadatos
 *      vengan a medias, y el hueco del marcador de posición también
 *      guarda la proporción.
 *
 * Nada de esto es un sistema nuevo: `ComponentRenders::img()` sigue
 * siendo la puerta por la que pasan las fotos de los bloques, y lo que
 * hace es llamar aquí.
 *
 * @package Meridian
 */

namespace Meridian\Media;

defined( 'ABSPATH' ) || exit;

class Images {

	/**
	 * Qué parte del ancho ocupa una foto según el papel que hace.
	 *
	 * El papel no es una decoración: es la diferencia entre bajarse 400
	 * KB o 40 KB. Lo pone quien renderiza el bloque, que es el único
	 * que sabe si la foto va a ancho completo o en una rejilla de tres.
	 */
	public const PAPELES = [
		// De borde a borde: portadas, fondos de sección.
		'full'    => '100vw',
		// Dentro del ancho máximo del contenido.
		'wide'    => '(max-width: 767px) 100vw, (max-width: 1279px) 92vw, 1200px',
		// Media pantalla: historias partidas, paneles.
		'half'    => '(max-width: 1023px) 100vw, 50vw',
		// Rejilla de tres: tarjetas, productos, entradas del blog.
		'third'   => '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw',
		// Rejilla de cuatro o más: fotos pequeñas, logos de tiendas.
		'quarter' => '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw',
		// Iconos y sellos: nunca pasan de un par de centímetros.
		'icon'    => '120px',
		// Caras de testimonios.
		'avatar'  => '96px',
	];

	/** El de siempre, para quien no diga nada. */
	public const POR_DEFECTO = 'wide';

	/**
	 * El atributo `sizes` de un papel.
	 *
	 * Admite también un número: «esta foto nunca pasa de 140 px», que es
	 * el caso del logo de la cabecera.
	 */
	public static function sizes( $papel ): string {
		if ( is_float( $papel ) ) {
			return self::sizes_para( $papel );
		}
		if ( is_int( $papel ) || ( is_string( $papel ) && ctype_digit( $papel ) ) ) {
			$px = max( 16, min( 3000, (int) $papel ) );
			return '(max-width: ' . $px . 'px) 100vw, ' . $px . 'px';
		}
		$papel = (string) $papel;
		if ( isset( self::PAPELES[ $papel ] ) ) {
			return self::PAPELES[ $papel ];
		}
		// Un `sizes` escrito a mano también vale: si trae un «px» o una
		// coma, es que ya es una lista de medidas.
		if ( str_contains( $papel, 'px' ) || str_contains( $papel, 'vw' ) ) {
			return $papel;
		}
		return self::PAPELES[ self::POR_DEFECTO ];
	}

	/**
	 * El `sizes` de una foto que ocupa una fracción del contenido.
	 *
	 * Lo calcula el renderizador según dónde esté puesta la foto: una
	 * columna de 4 pistas de 12 dentro de una rejilla de tres acaba
	 * siendo un noveno del ancho. En móvil casi todo se apila, así que
	 * por debajo de 768 px una foto que en escritorio es pequeña sigue
	 * valiendo la pantalla entera; por eso sólo se estrecha de tableta
	 * para arriba.
	 */
	public static function sizes_para( float $fraccion ): string {
		$f = max( 0.08, min( 1.0, $fraccion ) );
		if ( $f > 0.95 ) {
			return self::PAPELES['wide'];
		}
		$movil   = $f > 0.5 ? '100vw' : (int) round( $f * 2 * 100 ) . 'vw';
		$tableta = (int) round( max( 0.25, min( 1.0, $f * 1.6 ) ) * 92 ) . 'vw';
		$escrit  = (int) round( $f * 1200 ) . 'px';
		return '(max-width: 767px) ' . $movil . ', (max-width: 1279px) ' . $tableta . ', ' . $escrit;
	}

	/**
	 * La foto, con todo lo que necesita para no estorbar.
	 *
	 * @param int    $id    Adjunto.
	 * @param string $size  Tamaño de WordPress.
	 * @param array  $args  alt, class, papel, eager, extra (atributos sueltos).
	 */
	public static function tag( int $id, string $size = 'large', array $args = [] ): string {
		if ( ! $id ) {
			return '';
		}
		$eager = ! empty( $args['eager'] );
		$attrs = [
			'class'    => (string) ( $args['class'] ?? '' ),
			'alt'      => (string) ( $args['alt'] ?? '' ),
			'loading'  => $eager ? 'eager' : 'lazy',
			'decoding' => 'async',
			'sizes'    => self::sizes( $args['papel'] ?? self::POR_DEFECTO ),
		];
		if ( $eager ) {
			// Lo primero que se ve manda: se pide antes que el resto.
			$attrs['fetchpriority'] = 'high';
		}
		foreach ( (array) ( $args['extra'] ?? [] ) as $k => $v ) {
			$attrs[ $k ] = $v;
		}
		$html = wp_get_attachment_image( $id, $size, false, $attrs );
		if ( ! $html ) {
			return '';
		}
		$html = self::con_medidas( $html, $id, $size );
		return self::con_formatos( $html, $id, $size, $attrs['sizes'] );
	}

	/**
	 * Alto y ancho, pase lo que pase.
	 *
	 * WordPress los pone cuando los metadatos del adjunto están
	 * completos. Cuando no —una foto subida por FTP, una miniatura que
	 * nunca se generó—, los deja fuera y la página pega el salto. Aquí
	 * se rellenan con lo que haya: las medidas del tamaño pedido o, en
	 * su defecto, las del original.
	 */
	public static function con_medidas( string $html, int $id, string $size ): string {
		if ( preg_match( '/\swidth="\d+"/', $html ) && preg_match( '/\sheight="\d+"/', $html ) ) {
			return $html;
		}
		$dims = self::medidas( $id, $size );
		if ( ! $dims ) {
			return $html;
		}
		$html = preg_replace( '/\s(width|height)="\d*"/', '', $html );
		return preg_replace(
			'/<img /',
			'<img width="' . (int) $dims[0] . '" height="' . (int) $dims[1] . '" ',
			$html,
			1
		);
	}

	/** Las medidas de un tamaño concreto, o las del original. */
	public static function medidas( int $id, string $size ): ?array {
		$meta = wp_get_attachment_metadata( $id );
		if ( ! is_array( $meta ) ) {
			return null;
		}
		$s = $meta['sizes'][ $size ] ?? null;
		if ( is_array( $s ) && ! empty( $s['width'] ) && ! empty( $s['height'] ) ) {
			return [ (int) $s['width'], (int) $s['height'] ];
		}
		if ( ! empty( $meta['width'] ) && ! empty( $meta['height'] ) ) {
			return [ (int) $meta['width'], (int) $meta['height'] ];
		}
		return null;
	}

	/**
	 * El `<picture>` con las versiones modernas delante.
	 *
	 * Sólo si hay algo que ofrecer: si el adjunto no tiene hermanas en
	 * WebP o AVIF, la foto sale como siempre, en un `<img>` pelado. Un
	 * `<picture>` vacío sería ruido en el HTML.
	 */
	public static function con_formatos( string $html, int $id, string $size, string $sizes ): string {
		$fuentes = '';
		foreach ( [ 'image/avif', 'image/webp' ] as $mime ) {
			$srcset = Formats::srcset( $id, $mime );
			if ( '' === $srcset ) {
				continue;
			}
			$fuentes .= '<source type="' . esc_attr( $mime ) . '" srcset="' . esc_attr( $srcset )
				. '" sizes="' . esc_attr( $sizes ) . '">';
		}
		if ( '' === $fuentes ) {
			return $html;
		}
		return '<picture>' . $fuentes . $html . '</picture>';
	}

	/**
	 * El hueco de una foto que todavía no está puesta.
	 *
	 * Con su proporción, para que poner la foto luego no mueva nada de
	 * sitio. Si no se dice otra cosa, 3:2, que es la de la mayoría de
	 * las tarjetas del catálogo.
	 */
	public static function placeholder( string $class = '', string $ratio = '3 / 2', string $tag = 'div' ): string {
		$tag = in_array( $tag, [ 'div', 'span' ], true ) ? $tag : 'div';
		return '<' . $tag . ' class="m-img-placeholder ' . esc_attr( $class ) . '"'
			. ' style="aspect-ratio:' . esc_attr( $ratio ) . '" aria-hidden="true"></' . $tag . '>';
	}
}
