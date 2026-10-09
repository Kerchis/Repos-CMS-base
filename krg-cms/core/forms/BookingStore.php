<?php
/**
 * Dónde se guardan las reservas.
 *
 * Una ficha por reserva, en un tipo de contenido privado: no se
 * publica, no tiene página propia y no sale en los buscadores. El CMS
 * las lee desde la pantalla «Reservas».
 *
 * @package Meridian
 */

namespace Meridian\Forms;

defined( 'ABSPATH' ) || exit;

class BookingStore {

	public const TIPO   = 'krg_reserva';
	public const DATOS  = '_krg_reserva';
	public const CUANDO = '_krg_cuando';
	public const ESTADO = '_krg_estado';

	public const ESTADOS = [ 'nueva', 'confirmada', 'cancelada' ];

	/** Apunta una reserva. Devuelve su número, o 0 si no se pudo. */
	public static function add( array $r, int $page_id = 0 ): int {
		$id = wp_insert_post(
			[
				'post_type'   => self::TIPO,
				'post_status' => 'private',
				'post_title'  => Booking::titulo( $r ),
				'post_parent' => $page_id > 0 ? $page_id : 0,
			],
			true
		);
		if ( is_wp_error( $id ) || ! $id ) {
			\Meridian\Log\Logger::error( 'booking_store_failed', [ 'page' => $page_id ] );
			return 0;
		}
		update_post_meta( $id, self::DATOS, $r );
		update_post_meta( $id, self::CUANDO, $r['fecha'] . ' ' . $r['hora'] );
		update_post_meta( $id, self::ESTADO, 'nueva' );
		return (int) $id;
	}

	/** Una reserva en la forma que entiende el panel. */
	public static function ficha( \WP_Post $p ): array {
		$r  = get_post_meta( $p->ID, self::DATOS, true );
		$r  = is_array( $r ) ? $r : [];
		$es = (string) get_post_meta( $p->ID, self::ESTADO, true );
		return [
			'id'         => (int) $p->ID,
			'nombre'     => (string) ( $r['nombre'] ?? $p->post_title ),
			'email'      => (string) ( $r['email'] ?? '' ),
			'telefono'   => (string) ( $r['telefono'] ?? '' ),
			'fecha'      => (string) ( $r['fecha'] ?? '' ),
			'hora'       => (string) ( $r['hora'] ?? '' ),
			// El valor de arriba es el bueno, el de 24 horas, el que se
			// compara y se ordena. Éste es sólo para leerlo, escrito como
			// escribe la hora este sitio.
			'horaTexto'  => Booking::hora_texto( (string) ( $r['hora'] ?? '' ) ),
			'comensales' => (int) ( $r['comensales'] ?? 0 ),
			'mensaje'    => (string) ( $r['mensaje'] ?? '' ),
			'estado'     => in_array( $es, self::ESTADOS, true ) ? $es : 'nueva',
			'cuando'     => (string) get_post_meta( $p->ID, self::CUANDO, true ),
			'pedida'     => (string) $p->post_date,
			'pagina'     => (int) $p->post_parent,
		];
	}

	/**
	 * La lista.
	 *
	 * `cuales` = `proximas` (de hoy en adelante, sin las canceladas),
	 * `pasadas`, `canceladas` o `todas`.
	 */
	public static function lista( array $args = [] ): array {
		$cuales = (string) ( $args['cuales'] ?? 'proximas' );
		$cuales = in_array( $cuales, [ 'proximas', 'pasadas', 'canceladas', 'todas' ], true ) ? $cuales : 'proximas';
		$tope   = max( 1, min( 500, absint( $args['tope'] ?? 200 ) ?: 200 ) );

		$posts = get_posts(
			[
				'post_type'        => self::TIPO,
				'post_status'      => [ 'private', 'publish', 'draft' ],
				'numberposts'      => $tope,
				'orderby'          => [ 'meta_value' => 'ASC', 'ID' => 'ASC' ],
				'meta_key'         => self::CUANDO, // phpcs:ignore WordPress.DB.SlowDBQuery
				'suppress_filters' => false,
			]
		);

		$hoy   = Booking::fecha_de( Booking::ahora() );
		$out   = [];
		$suma  = [ 'nueva' => 0, 'confirmada' => 0, 'cancelada' => 0 ];
		foreach ( $posts as $p ) {
			$f = self::ficha( $p );
			$suma[ $f['estado'] ] = ( $suma[ $f['estado'] ] ?? 0 ) + 1;
			$futura  = $f['fecha'] >= $hoy;
			$cuenta  = 'todas' === $cuales
				|| ( 'proximas' === $cuales && $futura && 'cancelada' !== $f['estado'] )
				|| ( 'pasadas' === $cuales && ! $futura )
				|| ( 'canceladas' === $cuales && 'cancelada' === $f['estado'] );
			if ( $cuenta ) {
				$out[] = $f;
			}
		}
		if ( 'pasadas' === $cuales ) {
			$out = array_reverse( $out );
		}
		return [
			'cuales'   => $cuales,
			'reservas' => $out,
			'total'    => count( $posts ),
			'resumen'  => $suma,
			'hoy'      => $hoy,
		];
	}

	public static function set_estado( int $id, string $estado ): ?array {
		$p = get_post( $id );
		if ( ! $p || self::TIPO !== $p->post_type ) {
			return null;
		}
		if ( ! in_array( $estado, self::ESTADOS, true ) ) {
			return null;
		}
		update_post_meta( $id, self::ESTADO, $estado );
		return self::ficha( get_post( $id ) );
	}

	public static function borrar( int $id ): bool {
		$p = get_post( $id );
		if ( ! $p || self::TIPO !== $p->post_type ) {
			return false;
		}
		return (bool) wp_delete_post( $id, true );
	}

	/** Cuántas están sin mirar: para el aviso del menú. */
	public static function nuevas(): int {
		$lista = self::lista( [ 'cuales' => 'proximas' ] );
		$n     = 0;
		foreach ( $lista['reservas'] as $r ) {
			if ( 'nueva' === $r['estado'] ) {
				$n++;
			}
		}
		return $n;
	}
}
