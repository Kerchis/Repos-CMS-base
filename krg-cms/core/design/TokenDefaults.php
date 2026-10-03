<?php
/**
 * El valor por defecto de los tokens que el sistema necesita sí o sí.
 *
 * Por qué existe este archivo
 * ---------------------------
 * `--spacing-section` es el ritmo vertical de TODAS las secciones del
 * sitio. El CSS lo pide así:
 *
 *     :where(.m-c-section) { padding-block: var(--spacing-section, 96px); }
 *
 * El `96px` del final solo entra en juego cuando la variable NO existe.
 * Si la variable existe y vale `0px`, el sitio entero se queda sin
 * respiración y nadie lo nota en el panel: el inspector de un bloque no
 * enseña los tokens, y el panel de tokens enseña el `0px` como si fuera
 * una decisión. Eso es justo lo que pasaba.
 *
 * Aquí vive una sola vez la respuesta a «¿cuánto vale esto cuando nadie
 * ha dicho nada?», y de aquí sale tanto lo que ve el panel como lo que
 * compila el CSS. Si algún día cambia, cambia en un sitio.
 *
 * Qué NO hace: no pisa lo que el usuario haya configurado. Solo rellena
 * lo que falta y repara, una única vez y de forma declarada, un valor
 * que no puede ser intencionado.
 *
 * @package Meridian
 */

namespace Meridian\Design;

defined( 'ABSPATH' ) || exit;

class TokenDefaults {

	/** Marca de la reparación: se hace una vez y no vuelve a tocarse. */
	public const FIX_OPTION = 'meridian_tokens_fix_section';

	/**
	 * Tokens sin los cuales el tema se ve roto, con su valor de respaldo.
	 *
	 * El respaldo es el último recurso: primero se mira el preset activo
	 * y luego el preset que trae el tema. Este número tiene que ser el
	 * mismo que el de `var(--spacing-section, 96px)` en base.css.
	 */
	public const REQUIRED = [
		'spacing' => [
			'section' => '96px',
		],
		'layout'  => [
			'page-max-width' => '1200px',
		],
	];

	/**
	 * ¿Este valor es un valor, o es «aquí no hay nada»?
	 *
	 * Cadena vacía, `0`, `0px`, `none`… Para un ritmo de sección son lo
	 * mismo que no tener nada: el sitio se queda pegado. Un `0` escrito
	 * a propósito en un token global no distingue de un `0` escrito por
	 * un guardado a medias, y de los dos casos el malo es mucho más
	 * frecuente.
	 */
	public static function is_empty( $value ): bool {
		$v = is_array( $value ) ? ( $value['value'] ?? '' ) : $value;
		$v = strtolower( trim( (string) $v ) );
		if ( '' === $v || 'none' === $v || 'initial' === $v || 'unset' === $v ) {
			return true;
		}
		// `0`, `0px`, `0rem`, `0.0em`… todo lo que mide cero.
		return (bool) preg_match( '/^0+(\.0+)?(px|rem|em|%|vh|vw|svh|dvh)?$/', $v );
	}

	/**
	 * El valor por defecto de un token, buscado en este orden:
	 * preset activo → preset del tema → respaldo de este archivo.
	 */
	public static function fallback( string $group, string $key, string $preset_slug = '' ): string {
		foreach ( array_filter( [ $preset_slug, (string) ( defined( 'MERIDIAN_DEFAULT_PRESET' ) ? MERIDIAN_DEFAULT_PRESET : '' ), 'marca' ] ) as $slug ) {
			$preset = TokenRepository::load_preset_file( $slug );
			$valor  = $preset['tokens'][ $group ][ $key ] ?? null;
			if ( null !== $valor && ! self::is_empty( $valor ) ) {
				return (string) ( is_array( $valor ) ? ( $valor['value'] ?? '' ) : $valor );
			}
		}
		return (string) ( self::REQUIRED[ $group ][ $key ] ?? '' );
	}

	/**
	 * Rellena los tokens imprescindibles que falten.
	 *
	 * Se aplica al LEER, no al guardar: así una instalación con el token
	 * perdido se ve bien desde el primer momento, sin esperar a que
	 * alguien pulse Guardar, y el panel enseña exactamente el valor que
	 * va a usar el frontend. Lo que ya tiene valor no se toca.
	 */
	public static function fill( array $data ): array {
		$slug = (string) ( $data['activePreset'] ?? '' );
		foreach ( self::REQUIRED as $group => $claves ) {
			foreach ( $claves as $key => $_ ) {
				$actual = $data['tokens'][ $group ][ $key ] ?? null;
				if ( null !== $actual && ! self::is_empty( $actual ) ) {
					continue;
				}
				// Solo se rellena lo que falta o está vacío. Un valor
				// escrito por el usuario (aunque sea raro) se respeta.
				$data['tokens'][ $group ][ $key ] = [ 'value' => self::fallback( $group, $key, $slug ) ];
			}
		}
		return $data;
	}

	/**
	 * Repara en la base de datos un `spacing.section` inservible.
	 *
	 * `fill()` ya hace que el sitio se vea bien, pero deja el `0px`
	 * guardado: la próxima vez que alguien pulse «Guardar espaciado»,
	 * el panel —que ya enseña el valor bueno— lo escribe. Esto lo
	 * adelanta y lo deja apuntado, para que lo que hay en la base de
	 * datos y lo que se ve sean lo mismo.
	 *
	 * Se ejecuta UNA vez (marca en opciones). Si el usuario decide
	 * después poner cero a propósito, se queda en cero: esta pasada no
	 * vuelve.
	 */
	public static function repair_once(): void {
		if ( get_option( self::FIX_OPTION ) ) {
			return;
		}
		$data = get_option( MERIDIAN_OPTION_TOKENS );
		if ( ! is_array( $data ) || empty( $data['tokens'] ) ) {
			// Sin tokens guardados no hay nada que reparar: los creará
			// `ensure_defaults()` a partir del preset.
			return;
		}
		update_option( self::FIX_OPTION, 1, false );

		$tocado = false;
		$slug   = (string) ( $data['activePreset'] ?? '' );
		foreach ( self::REQUIRED as $group => $claves ) {
			foreach ( $claves as $key => $_ ) {
				$actual = $data['tokens'][ $group ][ $key ] ?? null;
				if ( null !== $actual && ! self::is_empty( $actual ) ) {
					continue;
				}
				$nuevo = self::fallback( $group, $key, $slug );
				if ( '' === $nuevo ) {
					continue;
				}
				$antes = $data['tokens'][ $group ][ $key ] ?? [];
				if ( ! is_array( $antes ) ) {
					$antes = [];
				}
				$antes['value'] = $nuevo;
				$data['tokens'][ $group ][ $key ] = $antes;
				$tocado = true;
			}
		}
		if ( ! $tocado ) {
			return;
		}
		update_option( MERIDIAN_OPTION_TOKENS, $data, false );

		// Las mismas invalidaciones que hace el repositorio al guardar.
		wp_cache_delete( MERIDIAN_OPTION_TOKENS, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		delete_transient( 'meridian_tokens_css' );
		if ( class_exists( '\\Meridian\\Cache\\DocumentCache' ) ) {
			\Meridian\Cache\DocumentCache::flush_chrome();
		}
	}
}
