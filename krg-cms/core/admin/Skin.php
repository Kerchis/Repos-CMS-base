<?php
/**
 * La piel del propio CMS: colores y densidad del panel y del constructor.
 *
 * admin.css y builder.css están escritos contra variables `--m-*`, así que
 * reskinear el panel es reescribir esas variables. Nada de esto afecta al
 * sitio público: `Skin::css()` solo se encola en el admin (ver
 * core/admin/Assets.php) y los tokens del sitio viven en otro sitio
 * (Design\TokenRepository). Son dos paletas distintas a propósito:
 *
 *   - la del sitio   → la elige quien construye la web, por cliente;
 *   - la del panel   → la elige el administrador, es la cara de KRG.
 *
 * Un tema es un juego completo de colores con nombre. Encima de un tema se
 * pueden guardar retoques sueltos; `get()` devuelve la suma de los dos.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Skin {

	/** Tema que se usa cuando nadie ha elegido nada. */
	public const TEMA_POR_DEFECTO = 'bronce';

	/**
	 * Clave interna => [variable CSS, etiqueta].
	 *
	 * El orden es el que se ve en el panel: primero lo que más se nota.
	 */
	public static function schema(): array {
		return [
			'sidebar'     => [ '--m-brown', __( 'Barra lateral', 'meridian' ) ],
			'sidebarDeep' => [ '--m-brown-deep', __( 'Barra lateral (tono oscuro)', 'meridian' ) ],
			'action'      => [ '--m-orange', __( 'Color de acción (botones)', 'meridian' ) ],
			'actionDeep'  => [ '--m-orange-deep', __( 'Acción al pasar el ratón', 'meridian' ) ],
			'accent'      => [ '--m-accent', __( 'Realce (insignias y selección)', 'meridian' ) ],
			'accentSoft'  => [ '--m-accent-soft', __( 'Tinte suave de acción', 'meridian' ) ],
			'paper'       => [ '--m-paper', __( 'Fondo del panel', 'meridian' ) ],
			'surface'     => [ '--m-surface', __( 'Superficie', 'meridian' ) ],
			'surfaceSoft' => [ '--m-surface-soft', __( 'Superficie suave', 'meridian' ) ],
			'card'        => [ '--m-white', __( 'Tarjetas y campos', 'meridian' ) ],
			'line'        => [ '--m-line', __( 'Líneas y bordes', 'meridian' ) ],
			'lineStrong'  => [ '--m-line-strong', __( 'Bordes marcados', 'meridian' ) ],
			'ink'         => [ '--m-ink', __( 'Texto', 'meridian' ) ],
			'muted'       => [ '--m-muted', __( 'Texto secundario', 'meridian' ) ],
			'ok'          => [ '--m-ok', __( 'Correcto', 'meridian' ) ],
			'warn'        => [ '--m-warn', __( 'Aviso', 'meridian' ) ],
			'danger'      => [ '--m-danger', __( 'Peligro', 'meridian' ) ],
		];
	}

	/**
	 * Los temas que trae KRG.
	 *
	 * Todos los pares de color que importan están comprobados en AA
	 * (4.5:1 para texto, 3:1 para interfaz) por tools/prueba-piel.php. Si
	 * alguien añade un tema aquí y no llega, el banco lo caza.
	 */
	public static function temas(): array {
		return [
			'bronce' => [
				'nombre'  => __( 'Bronce', 'meridian' ),
				'nota'    => __( 'Cálido y editorial. El de fábrica.', 'meridian' ),
				'colores' => [
					'sidebar'     => '#231a14',
					'sidebarDeep' => '#171009',
					'action'      => '#9f6637',
					'actionDeep'  => '#7a4d28',
					'accent'      => '#d9a441',
					'accentSoft'  => '#f3e2ce',
					'paper'       => '#faefd8',
					'surface'     => '#f5e8d2',
					'surfaceSoft' => '#fbf3e4',
					'card'        => '#fffdf8',
					'line'        => '#e4d2b6',
					'lineStrong'  => '#c9b18d',
					'ink'         => '#1d1d1b',
					'muted'       => '#6b5744',
					'ok'          => '#3f6b4a',
					'warn'        => '#8a5a10',
					'danger'      => '#a33a2a',
				],
			],
			'oceano' => [
				'nombre'  => __( 'Océano', 'meridian' ),
				'nota'    => __( 'Frío y técnico, con naranja de realce.', 'meridian' ),
				'colores' => [
					'sidebar'     => '#002b4c',
					'sidebarDeep' => '#001b30',
					'action'      => '#00466f',
					'actionDeep'  => '#002b4c',
					'accent'      => '#f59e71',
					'accentSoft'  => '#dcf1ff',
					'paper'       => '#f2faff',
					'surface'     => '#e4f3fc',
					'surfaceSoft' => '#f8fcff',
					'card'        => '#ffffff',
					'line'        => '#cbe3f0',
					'lineStrong'  => '#9cc3da',
					'ink'         => '#0b2033',
					'muted'       => '#4a6980',
					'ok'          => '#1f6b4f',
					'warn'        => '#8a5207',
					'danger'      => '#a3302a',
				],
			],
			'bosque' => [
				'nombre'  => __( 'Bosque', 'meridian' ),
				'nota'    => __( 'El verde de siempre, el de las primeras versiones.', 'meridian' ),
				'colores' => [
					'sidebar'     => '#3f5e58',
					'sidebarDeep' => '#2b413d',
					'action'      => '#3f5e58',
					'actionDeep'  => '#2b413d',
					'accent'      => '#e8c27a',
					'accentSoft'  => '#e7eeec',
					'paper'       => '#fef6e7',
					'surface'     => '#f7ead1',
					'surfaceSoft' => '#fbf2e1',
					'card'        => '#ffffff',
					'line'        => '#e1d3b6',
					'lineStrong'  => '#cbb894',
					'ink'         => '#0c0f0e',
					'muted'       => '#5f5a50',
					'ok'          => '#3f6b4a',
					'warn'        => '#8a5a10',
					'danger'      => '#a33a2a',
				],
			],
		];
	}

	/**
	 * Slug del tema activo. Si lo guardado ya no existe, el de fábrica.
	 */
	public static function tema(): string {
		$slug = (string) get_option( MERIDIAN_OPTION_ADMIN_THEME, self::TEMA_POR_DEFECTO );
		return isset( self::temas()[ $slug ] ) ? $slug : self::TEMA_POR_DEFECTO;
	}

	/**
	 * Los colores del tema activo, sin los retoques del administrador.
	 *
	 * Esto es lo que el panel llama «valores de fábrica»: restablecer
	 * devuelve aquí, no al verde de la primera versión.
	 */
	public static function defaults(): array {
		$temas = self::temas();
		return $temas[ self::tema() ]['colores'];
	}

	/**
	 * Retoques sueltos guardados encima del tema.
	 */
	public static function overrides(): array {
		$saved = get_option( MERIDIAN_OPTION_ADMIN_SKIN, [] );
		return is_array( $saved ) ? self::sanitize( $saved ) : [];
	}

	/**
	 * Lo que se ve de verdad: tema + retoques.
	 */
	public static function get(): array {
		return array_merge( self::defaults(), self::overrides() );
	}

	/**
	 * Solo claves conocidas y solo colores hex válidos.
	 */
	public static function sanitize( array $data ): array {
		$out = [];
		foreach ( self::schema() as $key => $row ) {
			if ( ! array_key_exists( $key, $data ) ) {
				continue;
			}
			$hex = sanitize_hex_color( (string) $data[ $key ] );
			if ( $hex ) {
				$out[ $key ] = strtolower( $hex );
			}
		}
		return $out;
	}

	/**
	 * Guarda tema y/o retoques.
	 *
	 * Cambiar de tema borra los retoques: si no, el tema nuevo saldría
	 * manchado con los colores del anterior y nadie entendería por qué.
	 *
	 * @param array $data ['theme' => slug, 'colors' => [clave => hex]].
	 */
	public static function save( array $data ): array {
		if ( isset( $data['theme'] ) ) {
			$slug = (string) $data['theme'];
			if ( isset( self::temas()[ $slug ] ) ) {
				update_option( MERIDIAN_OPTION_ADMIN_THEME, $slug, false );
				delete_option( MERIDIAN_OPTION_ADMIN_SKIN );
			}
		}
		if ( isset( $data['colors'] ) && is_array( $data['colors'] ) ) {
			// Solo se guarda lo que de verdad se aparta del tema: así, al
			// cambiar de tema más adelante, no arrastras doce colores
			// iguales que te impiden ver el tema nuevo.
			$base  = self::defaults();
			$limpio = [];
			foreach ( self::sanitize( $data['colors'] ) as $key => $hex ) {
				if ( ! isset( $base[ $key ] ) || strtolower( $base[ $key ] ) !== $hex ) {
					$limpio[ $key ] = $hex;
				}
			}
			if ( $limpio ) {
				update_option( MERIDIAN_OPTION_ADMIN_SKIN, $limpio, false );
			} else {
				delete_option( MERIDIAN_OPTION_ADMIN_SKIN );
			}
		}
		return self::get();
	}

	/**
	 * Quita los retoques y vuelve al tema de fábrica.
	 */
	public static function reset(): array {
		delete_option( MERIDIAN_OPTION_ADMIN_SKIN );
		delete_option( MERIDIAN_OPTION_ADMIN_THEME );
		return self::get();
	}

	/**
	 * Propone unos colores de panel a partir de la paleta del sitio.
	 *
	 * Es un puente opcional, nunca automático: la piel del CMS y la paleta
	 * de la web del cliente son cosas distintas, y esto solo existe para
	 * quien quiera, a mano, que vayan a juego.
	 */
	public static function from_tokens(): array {
		$color = \Meridian\Design\TokenRepository::get()['tokens']['color'] ?? [];
		$pick  = static function ( string $key, string $fallback ) use ( $color ): string {
			$hex = sanitize_hex_color( (string) ( $color[ $key ]['value'] ?? '' ) );
			return $hex ? $hex : $fallback;
		};
		$d = self::defaults();
		return [
			'sidebar'     => $pick( 'primary', $d['sidebar'] ),
			'sidebarDeep' => $pick( 'secondary', $d['sidebarDeep'] ),
			'action'      => $pick( 'primary', $d['action'] ),
			'actionDeep'  => $pick( 'secondary', $d['actionDeep'] ),
			'accent'      => $pick( 'highlight', $d['accent'] ),
			'accentSoft'  => $pick( 'highlight', $d['accentSoft'] ),
			'paper'       => $pick( 'background', $d['paper'] ),
			'surface'     => $pick( 'surface', $d['surface'] ),
			'surfaceSoft' => $pick( 'surface-alt', $d['surfaceSoft'] ),
			'card'        => $pick( 'surface-alt', $d['card'] ),
			'line'        => $pick( 'border', $d['line'] ),
			'lineStrong'  => $pick( 'border-strong', $d['lineStrong'] ),
			'ink'         => $pick( 'text', $d['ink'] ),
			'muted'       => $pick( 'muted', $d['muted'] ),
			'ok'          => $pick( 'success', $d['ok'] ),
			'warn'        => $pick( 'warning', $d['warn'] ),
			'danger'      => $pick( 'error', $d['danger'] ),
		];
	}

	/**
	 * CSS en línea para el panel.
	 *
	 * Emite SIEMPRE el juego completo, no solo lo retocado. Así la cara de
	 * fábrica la manda este fichero y no el `:root` de admin.css, que se
	 * queda de red de seguridad para cuando el CSS se abre suelto (los
	 * bancos de pruebas) o si esta opción no llega.
	 */
	public static function css(): string {
		$schema = self::schema();
		$decl   = [];
		foreach ( self::get() as $key => $hex ) {
			if ( isset( $schema[ $key ] ) ) {
				$decl[] = $schema[ $key ][0] . ':' . $hex;
			}
		}
		return $decl ? ':root{' . implode( ';', $decl ) . ';}' : '';
	}
}
