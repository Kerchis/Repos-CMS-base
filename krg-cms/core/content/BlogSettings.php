<?php
/**
 * Ajustes del blog que valen para toda la web.
 *
 * De momento solo uno: si las categorias se le ensenan o no a quien
 * visita el sitio. Es un interruptor global —vive en la pantalla de
 * Blog del panel—, no una opcion por entrada.
 *
 * Vive en su propia opcion y no dentro de `meridian_settings` a
 * proposito: aquella la reescribe entera la pantalla de Configuracion
 * cada vez que se guarda, asi que cualquier clave que no conozca se
 * perderia.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class BlogSettings {

	/**
	 * Los ajustes completos, con los valores por defecto puestos.
	 *
	 * Por defecto las categorias SE VEN: es como se comportaba el tema
	 * antes de que existiera el interruptor, y un ajuste nuevo no puede
	 * cambiarle la web a nadie por sorpresa.
	 */
	public static function get(): array {
		$s = get_option( MERIDIAN_OPTION_BLOG, [] );
		$s = is_array( $s ) ? $s : [];
		return [
			'showCategories' => ! array_key_exists( 'showCategories', $s ) || ! empty( $s['showCategories'] ),
		];
	}

	public static function show_categories(): bool {
		return (bool) self::get()['showCategories'];
	}

	/**
	 * Guarda los ajustes.
	 *
	 * Se lee en cada pagina publica (el modulo de categorias y la
	 * cabecera SEO preguntan), asi que la opcion va con autoload.
	 */
	public static function save( array $data ): array {
		$out = [ 'showCategories' => ! empty( $data['showCategories'] ) ];
		update_option( MERIDIAN_OPTION_BLOG, $out, true );
		return $out;
	}
}
