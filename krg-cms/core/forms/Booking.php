<?php
/**
 * Reserva de mesa: las reglas, la comprobación y el aviso.
 *
 * El bloque «Reserva de mesa» pinta el selector y este archivo decide
 * qué es una reserva válida. Las dos mitades —el guión del navegador y
 * esta— parten de la misma configuración, pero la que manda es esta:
 * del formulario no se cree ni el número de WhatsApp ni el correo de
 * destino, que se leen del bloque tal y como está guardado en la
 * página. Si alguien falsea el envío, el aviso sigue yendo a donde
 * dice el CMS.
 *
 * @package Meridian
 */

namespace Meridian\Forms;

defined( 'ABSPATH' ) || exit;

class Booking {

	/** Los días de la semana como los numera ISO: 1 lunes … 7 domingo. */
	public const DIAS = [
		1 => 'lun',
		2 => 'mar',
		3 => 'mie',
		4 => 'jue',
		5 => 'vie',
		6 => 'sab',
		7 => 'dom',
	];

	/** Cuántas peticiones se admiten desde la misma conexión y en cuánto rato. */
	private const TOPE      = 6;
	private const VENTANA   = 600;

	/**
	 * La configuración del bloque, ya puesta en limpio.
	 *
	 * Devuelve siempre la misma forma, haya o no props: así el
	 * renderizador, el guión y la comprobación leen lo mismo.
	 */
	public static function config( array $props ): array {
		$slot = absint( $props['slot'] ?? 30 );
		$slot = in_array( $slot, [ 15, 30, 45, 60 ], true ) ? $slot : 30;

		$turnos = [];
		foreach ( (array) ( $props['turnos'] ?? [] ) as $t ) {
			if ( ! is_array( $t ) ) {
				continue;
			}
			$ini = self::hora( (string) ( $t['start'] ?? '' ) );
			$fin = self::hora( (string) ( $t['end'] ?? '' ) );
			if ( '' === $ini || '' === $fin || self::minutos( $fin ) < self::minutos( $ini ) ) {
				continue;
			}
			$dias = [];
			foreach ( self::DIAS as $n => $clave ) {
				if ( ! empty( $t[ $clave ] ) ) {
					$dias[] = $n;
				}
			}
			if ( ! $dias ) {
				$dias = array_keys( self::DIAS );
			}
			$turnos[] = [
				'label' => sanitize_text_field( (string) ( $t['label'] ?? '' ) ),
				'start' => $ini,
				'end'   => $fin,
				'dias'  => $dias,
			];
		}
		// Sin turnos configurados el bloque seguiría funcionando, pero
		// sin horas que ofrecer. Se parte de un horario corriente para
		// que la sección recién puesta ya se pueda usar.
		if ( ! $turnos ) {
			$turnos = [
				[
					'label' => __( 'Comida', 'meridian' ),
					'start' => '13:00',
					'end'   => '15:30',
					'dias'  => array_keys( self::DIAS ),
				],
				[
					'label' => __( 'Cena', 'meridian' ),
					'start' => '20:00',
					'end'   => '22:30',
					'dias'  => array_keys( self::DIAS ),
				],
			];
		}

		$destino = (string) ( $props['destino'] ?? 'ambos' );
		$destino = in_array( $destino, [ 'correo', 'whatsapp', 'ambos' ], true ) ? $destino : 'ambos';
		$wa      = self::telefono( (string) ( $props['whatsapp'] ?? '' ) );
		// Sin número no hay WhatsApp que valga: el destino cae al correo
		// en vez de dejar la reserva sin avisar a nadie.
		if ( '' === $wa && 'correo' !== $destino ) {
			$destino = 'correo';
		}

		$max = absint( $props['maxGuests'] ?? 12 );
		$max = max( 1, min( 60, $max ?: 12 ) );
		$gen = absint( $props['guests'] ?? 2 );

		return [
			'submit'    => sanitize_text_field( (string) ( $props['submit'] ?? __( 'Pedir mesa', 'meridian' ) ) ),
			'success'   => sanitize_text_field( (string) ( $props['success'] ?? __( 'Hemos recibido tu petición. Te confirmamos enseguida.', 'meridian' ) ) ),
			'waBoton'   => sanitize_text_field( (string) ( $props['waBoton'] ?? __( 'Enviar por WhatsApp', 'meridian' ) ) ),
			'slot'      => $slot,
			'lead'      => max( 0, min( 20160, absint( $props['lead'] ?? 120 ) ) ),
			'days'      => max( 1, min( 365, absint( $props['days'] ?? 30 ) ?: 30 ) ),
			'maxGuests' => $max,
			'guests'    => max( 1, min( $max, $gen ?: 2 ) ),
			'turnos'    => $turnos,
			'cerrados'  => self::cerrados( (string) ( $props['closed'] ?? '' ) ),
			'destino'   => $destino,
			'whatsapp'  => $wa,
			'email'     => sanitize_email( (string) ( $props['email'] ?? '' ) ),
			'mensaje'   => ! array_key_exists( 'showMessage', $props ) || ! empty( $props['showMessage'] ),
		];
	}

	/** Lo que el guión necesita para pintar el selector. */
	public static function para_js( array $cfg ): array {
		return [
			'slot'      => $cfg['slot'],
			'lead'      => $cfg['lead'],
			'days'      => $cfg['days'],
			'maxGuests' => $cfg['maxGuests'],
			'guests'    => $cfg['guests'],
			'turnos'    => $cfg['turnos'],
			'cerrados'  => $cfg['cerrados'],
		];
	}

	/** «9:5» no es una hora; «09:05» sí. Devuelve '' si no lo es. */
	public static function hora( string $raw ): string {
		$raw = trim( $raw );
		if ( ! preg_match( '/^(\d{1,2})[:.h ]?(\d{2})$/u', $raw, $m ) ) {
			return '';
		}
		$h = (int) $m[1];
		$i = (int) $m[2];
		if ( $h > 23 || $i > 59 ) {
			return '';
		}
		return sprintf( '%02d:%02d', $h, $i );
	}

	public static function minutos( string $hhmm ): int {
		$p = explode( ':', $hhmm );
		return ( (int) ( $p[0] ?? 0 ) ) * 60 + (int) ( $p[1] ?? 0 );
	}

	/** Las fechas cerradas, escritas de corrido o una por línea. */
	public static function cerrados( string $raw ): array {
		$out = [];
		foreach ( preg_split( '/[\s,;]+/', trim( $raw ) ) ?: [] as $trozo ) {
			$trozo = trim( $trozo );
			if ( '' === $trozo ) {
				continue;
			}
			if ( preg_match( '#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $trozo, $m ) ) {
				$trozo = sprintf( '%04d-%02d-%02d', $m[3], $m[2], $m[1] );
			}
			if ( self::fecha_valida( $trozo ) ) {
				$out[] = $trozo;
			}
		}
		return array_values( array_unique( $out ) );
	}

	public static function fecha_valida( string $f ): bool {
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $f, $m ) ) {
			return false;
		}
		return checkdate( (int) $m[2], (int) $m[3], (int) $m[1] );
	}

	/** Qué turnos atienden ese día. */
	public static function turnos_del_dia( array $cfg, string $fecha ): array {
		if ( ! self::fecha_valida( $fecha ) || in_array( $fecha, $cfg['cerrados'], true ) ) {
			return [];
		}
		$n   = (int) gmdate( 'N', (int) strtotime( $fecha . ' 12:00:00 UTC' ) );
		$out = [];
		foreach ( $cfg['turnos'] as $t ) {
			if ( in_array( $n, $t['dias'], true ) ) {
				$out[] = $t;
			}
		}
		return $out;
	}

	/**
	 * Las horas que se pueden pedir ese día.
	 *
	 * `$ahora` es la marca de tiempo contra la que se mide la
	 * antelación mínima; por defecto, la hora del sitio.
	 */
	public static function huecos( array $cfg, string $fecha, ?int $ahora = null ): array {
		$turnos = self::turnos_del_dia( $cfg, $fecha );
		if ( ! $turnos ) {
			return [];
		}
		$ahora  = null === $ahora ? self::ahora() : $ahora;
		$limite = $ahora + ( $cfg['lead'] * 60 );
		$out    = [];
		foreach ( $turnos as $t ) {
			$ini = self::minutos( $t['start'] );
			$fin = self::minutos( $t['end'] );
			for ( $m = $ini; $m <= $fin; $m += $cfg['slot'] ) {
				$hhmm = sprintf( '%02d:%02d', intdiv( $m, 60 ), $m % 60 );
				if ( self::marca( $fecha, $hhmm ) < $limite ) {
					continue;
				}
				$out[ $hhmm ] = true;
			}
		}
		$out = array_keys( $out );
		sort( $out );
		return $out;
	}

	/** Los días con hueco, de hoy en adelante. */
	public static function dias_abiertos( array $cfg, ?int $ahora = null ): array {
		$ahora = null === $ahora ? self::ahora() : $ahora;
		$hoy   = self::fecha_de( $ahora );
		$out   = [];
		for ( $i = 0; $i < $cfg['days']; $i++ ) {
			$f = gmdate( 'Y-m-d', (int) strtotime( $hoy . ' 12:00:00 UTC' ) + ( $i * DAY_IN_SECONDS ) );
			if ( self::huecos( $cfg, $f, $ahora ) ) {
				$out[] = $f;
			}
		}
		return $out;
	}

	/** La hora del sitio, no la del servidor ni la del visitante. */
	public static function ahora(): int {
		return function_exists( 'current_datetime' ) ? current_datetime()->getTimestamp() : time();
	}

	/** El instante de una fecha y una hora, en la zona del sitio. */
	public static function marca( string $fecha, string $hora ): int {
		$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
		try {
			$d = new \DateTimeImmutable( $fecha . ' ' . $hora . ':00', $tz );
		} catch ( \Exception $e ) {
			return 0;
		}
		return $d->getTimestamp();
	}

	public static function fecha_de( int $marca ): string {
		$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new \DateTimeZone( 'UTC' );
		return ( new \DateTimeImmutable( '@' . $marca ) )->setTimezone( $tz )->format( 'Y-m-d' );
	}

	/** «jueves 16 de octubre de 2026», con los nombres del idioma del sitio. */
	public static function fecha_larga( string $fecha ): string {
		$marca = self::marca( $fecha, '12:00' );
		if ( ! $marca ) {
			return $fecha;
		}
		if ( function_exists( 'wp_date' ) ) {
			$txt = wp_date( 'l j \d\e F \d\e Y', $marca );
			if ( is_string( $txt ) && '' !== $txt ) {
				return $txt;
			}
		}
		return gmdate( 'Y-m-d', $marca );
	}

	/**
	 * Un número de teléfono en el formato internacional, sólo dígitos.
	 *
	 * Es lo que pide el enlace de WhatsApp: ni «+», ni espacios, ni
	 * guiones. Si lo escrito no parece un número de verdad, cadena
	 * vacía y el destino se cae al correo.
	 */
	public static function telefono( string $raw ): string {
		$d = preg_replace( '/\D+/', '', $raw );
		$d = is_string( $d ) ? ltrim( $d, '0' ) : '';
		return ( strlen( $d ) >= 8 && strlen( $d ) <= 15 ) ? $d : '';
	}

	/** El enlace oficial de «abrir una conversación», sin API ni claves. */
	public static function enlace_whatsapp( string $numero, string $texto ): string {
		$numero = self::telefono( $numero );
		if ( '' === $numero ) {
			return '';
		}
		return 'https://wa.me/' . $numero . '?text=' . rawurlencode( $texto );
	}

	/** El mensaje que se va a mandar, en texto corrido. */
	public static function texto( array $r ): string {
		$lineas = [
			sprintf(
				/* translators: %s: número de comensales. */
				_n( 'Reserva para %s persona', 'Reserva para %s personas', $r['comensales'], 'meridian' ),
				number_format_i18n( $r['comensales'] )
			),
			self::fecha_larga( $r['fecha'] ) . ' · ' . $r['hora'],
			'',
			/* translators: %s: nombre de quien reserva. */
			sprintf( __( 'Nombre: %s', 'meridian' ), $r['nombre'] ),
			/* translators: %s: teléfono de quien reserva. */
			sprintf( __( 'Teléfono: %s', 'meridian' ), $r['telefono'] ),
		];
		if ( ! empty( $r['email'] ) ) {
			/* translators: %s: correo de quien reserva. */
			$lineas[] = sprintf( __( 'Email: %s', 'meridian' ), $r['email'] );
		}
		if ( ! empty( $r['mensaje'] ) ) {
			$lineas[] = '';
			/* translators: %s: nota escrita por quien reserva. */
			$lineas[] = sprintf( __( 'Nota: %s', 'meridian' ), $r['mensaje'] );
		}
		return implode( "\n", $lineas );
	}

	/**
	 * Las props del bloque tal y como están guardadas.
	 *
	 * Se busca en lo publicado de esa página y, si no aparece, en los
	 * componentes globales. Lo que llega por el formulario no decide
	 * nada: sólo señala dónde mirar.
	 */
	public static function props_de_nodo( int $page_id, string $node_id ): ?array {
		if ( $page_id > 0 ) {
			// Lo publicado manda, que es lo que ve la gente. El
			// borrador es el plan B: desde «Preview» se puede probar
			// una sección de reserva que todavía no está publicada, y
			// ahí también tiene que funcionar.
			foreach ( [ 'published', 'draft' ] as $estado ) {
				$doc = \Meridian\Content\PageRepository::get( $page_id, $estado );
				if ( ! is_array( $doc ) ) {
					continue;
				}
				$hit = self::buscar_nodo( (array) ( $doc['sections'] ?? [] ), $node_id );
				if ( null !== $hit ) {
					return $hit;
				}
			}
		}
		$globales = get_posts(
			[
				'post_type'        => 'meridian_global',
				'numberposts'      => 100,
				'post_status'      => 'any',
				'suppress_filters' => false,
			]
		);
		foreach ( $globales as $g ) {
			$doc = \Meridian\Content\Document::decode( get_post_meta( $g->ID, MERIDIAN_META_DRAFT, true ) );
			$hit = self::buscar_nodo( (array) ( $doc['sections'] ?? ( $doc['nodes'] ?? [] ) ), $node_id );
			if ( null !== $hit ) {
				return $hit;
			}
		}
		return null;
	}

	/** @return array<string, mixed>|null */
	private static function buscar_nodo( array $nodos, string $node_id ): ?array {
		foreach ( $nodos as $n ) {
			if ( ! is_array( $n ) ) {
				continue;
			}
			if ( 'booking-form' === ( $n['type'] ?? '' ) && (string) ( $n['id'] ?? '' ) === $node_id ) {
				return is_array( $n['props'] ?? null ) ? $n['props'] : [];
			}
			if ( ! empty( $n['children'] ) && is_array( $n['children'] ) ) {
				$hit = self::buscar_nodo( $n['children'], $node_id );
				if ( null !== $hit ) {
					return $hit;
				}
			}
		}
		return null;
	}

	/**
	 * Comprueba una petición contra la configuración del bloque.
	 *
	 * @return array{ok: bool, error?: string, datos?: array}
	 */
	public static function revisar( array $in, array $cfg, ?int $ahora = null ): array {
		$nombre    = trim( sanitize_text_field( (string) ( $in['name'] ?? '' ) ) );
		$email     = sanitize_email( (string) ( $in['email'] ?? '' ) );
		$telefono  = trim( sanitize_text_field( (string) ( $in['phone'] ?? '' ) ) );
		$fecha     = trim( (string) ( $in['fecha'] ?? '' ) );
		$hora      = self::hora( (string) ( $in['hora'] ?? '' ) );
		$gente     = absint( $in['comensales'] ?? 0 );
		$mensaje   = sanitize_textarea_field( (string) ( $in['message'] ?? '' ) );

		if ( '' === $nombre ) {
			return [ 'ok' => false, 'error' => __( 'Dinos tu nombre.', 'meridian' ) ];
		}
		if ( strlen( preg_replace( '/\D+/', '', $telefono ) ?? '' ) < 6 ) {
			return [ 'ok' => false, 'error' => __( 'Hace falta un teléfono para confirmarte la mesa.', 'meridian' ) ];
		}
		if ( '' !== (string) ( $in['email'] ?? '' ) && ! is_email( $email ) ) {
			return [ 'ok' => false, 'error' => __( 'Ese correo no parece válido.', 'meridian' ) ];
		}
		if ( ! self::fecha_valida( $fecha ) ) {
			return [ 'ok' => false, 'error' => __( 'Elige el día.', 'meridian' ) ];
		}
		if ( '' === $hora ) {
			return [ 'ok' => false, 'error' => __( 'Elige la hora.', 'meridian' ) ];
		}
		if ( $gente < 1 || $gente > $cfg['maxGuests'] ) {
			return [
				'ok'    => false,
				'error' => sprintf(
					/* translators: %s: número máximo de comensales. */
					__( 'Para ese número de personas, llámanos y lo organizamos (el máximo por web es %s).', 'meridian' ),
					number_format_i18n( $cfg['maxGuests'] )
				),
			];
		}
		$ahora = null === $ahora ? self::ahora() : $ahora;
		$tope  = self::fecha_de( $ahora + ( $cfg['days'] * DAY_IN_SECONDS ) );
		if ( $fecha > $tope ) {
			return [ 'ok' => false, 'error' => __( 'Todavía no abrimos reservas para ese día.', 'meridian' ) ];
		}
		if ( in_array( $fecha, $cfg['cerrados'], true ) ) {
			return [ 'ok' => false, 'error' => __( 'Ese día está cerrado. Elige otro, por favor.', 'meridian' ) ];
		}
		$huecos = self::huecos( $cfg, $fecha, $ahora );
		if ( ! $huecos ) {
			return [ 'ok' => false, 'error' => __( 'Ese día ya no tiene horas libres. Elige otro, por favor.', 'meridian' ) ];
		}
		if ( ! in_array( $hora, $huecos, true ) ) {
			return [ 'ok' => false, 'error' => __( 'Esa hora ya no está disponible. Elige otra, por favor.', 'meridian' ) ];
		}

		return [
			'ok'    => true,
			'datos' => [
				'nombre'     => $nombre,
				'email'      => $email,
				'telefono'   => $telefono,
				'fecha'      => $fecha,
				'hora'       => $hora,
				'comensales' => $gente,
				'mensaje'    => $cfg['mensaje'] ? $mensaje : '',
			],
		];
	}

	/** El asunto del correo y el título de la ficha guardada. */
	public static function titulo( array $r ): string {
		return sprintf(
			/* translators: 1: nombre, 2: comensales, 3: fecha, 4: hora. */
			__( '%1$s · %2$s pers. · %3$s %4$s', 'meridian' ),
			$r['nombre'],
			number_format_i18n( $r['comensales'] ),
			$r['fecha'],
			$r['hora']
		);
	}

	/** El manejador del envío. */
	public static function handle(): void {
		$nonce = sanitize_text_field( wp_unslash( $_POST['krg_nonce'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		if ( ! wp_verify_nonce( $nonce, 'krg_booking' ) ) {
			wp_send_json_error( [ 'message' => __( 'La sesión no es válida. Recarga la página.', 'meridian' ) ], 403 );
		}
		// Campo trampa: los robots lo rellenan, las personas no lo ven.
		if ( ! empty( $_POST['website'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			wp_send_json_success( [ 'message' => __( 'Hemos recibido tu petición.', 'meridian' ) ] );
		}
		if ( ! self::pasa_el_freno() ) {
			wp_send_json_error( [ 'message' => __( 'Has enviado varias peticiones seguidas. Espera un momento, por favor.', 'meridian' ) ], 429 );
		}

		$page_id = absint( $_POST['pageId'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification
		$node_id = sanitize_text_field( wp_unslash( $_POST['nodeId'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		$props   = self::props_de_nodo( $page_id, $node_id );
		// Si el bloque no aparece —página borrada, nodo renombrado— se
		// sigue aceptando la reserva con las reglas de serie, pero el
		// aviso va al correo del sitio: nunca a un número que venga
		// escrito en la petición.
		$cfg = self::config( is_array( $props ) ? $props : [] );
		if ( null === $props ) {
			$cfg['destino']  = 'correo';
			$cfg['whatsapp'] = '';
		}

		$in = [
			'name'       => wp_unslash( $_POST['name'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'email'      => wp_unslash( $_POST['email'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'phone'      => wp_unslash( $_POST['phone'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'fecha'      => wp_unslash( $_POST['fecha'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'hora'       => wp_unslash( $_POST['hora'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'comensales' => wp_unslash( $_POST['comensales'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
			'message'    => wp_unslash( $_POST['message'] ?? '' ), // phpcs:ignore WordPress.Security.NonceVerification
		];

		$revision = self::revisar( $in, $cfg );
		if ( empty( $revision['ok'] ) ) {
			wp_send_json_error( [ 'message' => $revision['error'] ], 400 );
		}
		$datos = $revision['datos'];

		$id = BookingStore::add( $datos, $page_id );

		$avisos = [];
		if ( 'whatsapp' !== $cfg['destino'] ) {
			$avisos['correo'] = self::avisar_por_correo( $datos, $cfg );
		}

		$respuesta = [
			'message' => $cfg['success'],
			'id'      => $id,
		];
		if ( 'correo' !== $cfg['destino'] && $cfg['whatsapp'] ) {
			$respuesta['wa'] = [
				'url'   => self::enlace_whatsapp( $cfg['whatsapp'], self::texto( $datos ) ),
				'label' => $cfg['waBoton'],
			];
		}
		if ( ! $id && empty( $avisos['correo'] ) && empty( $respuesta['wa'] ) ) {
			\Meridian\Log\Logger::error( 'booking_sin_destino', [ 'page' => $page_id ] );
			wp_send_json_error( [ 'message' => __( 'No se pudo registrar la reserva. Llámanos, por favor.', 'meridian' ) ], 500 );
		}
		wp_send_json_success( $respuesta );
	}

	private static function avisar_por_correo( array $r, array $cfg ): bool {
		$to = $cfg['email'] ?: get_option( 'admin_email' );
		if ( ! is_email( $to ) ) {
			return false;
		}
		/* translators: %s: resumen de la reserva. */
		$asunto  = sprintf( __( 'Reserva: %s', 'meridian' ), self::titulo( $r ) );
		$cuerpo  = self::texto( $r );
		$cabecera = [];
		if ( $r['email'] ) {
			$cabecera[] = 'Reply-To: ' . $r['nombre'] . ' <' . $r['email'] . '>';
		}
		$enviado = wp_mail( $to, $asunto, $cuerpo, $cabecera );
		if ( ! $enviado ) {
			\Meridian\Log\Logger::error( 'booking_mail_failed', [ 'to' => $to ] );
		}
		return (bool) $enviado;
	}

	/** Freno sencillo por conexión: ni una por segundo ni cien por minuto. */
	private static function pasa_el_freno(): bool {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		if ( '' === $ip ) {
			return true;
		}
		$clave = 'krg_bk_' . md5( $ip );
		$n     = (int) get_transient( $clave );
		if ( $n >= self::TOPE ) {
			return false;
		}
		set_transient( $clave, $n + 1, self::VENTANA );
		return true;
	}
}
