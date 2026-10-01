<?php
/**
 * WordPress users CRUD for KRG CMS admins.
 *
 * @package Meridian
 */

namespace Meridian\Admin;

defined( 'ABSPATH' ) || exit;

class Users {

	public const ROLES = [ 'administrator', 'editor', 'author', 'contributor', 'subscriber' ];

	public static function can(): bool {
		return current_user_can( 'create_users' ) && current_user_can( 'meridian_manage' );
	}

	public static function list(): array {
		$out = [];
		foreach ( get_users( [ 'orderby' => 'ID', 'order' => 'ASC' ] ) as $u ) {
			$out[] = self::one( $u );
		}
		return $out;
	}

	public static function one( \WP_User $u ): array {
		$role = $u->roles[0] ?? 'subscriber';
		return [
			'id'          => (int) $u->ID,
			'login'       => $u->user_login,
			'email'       => $u->user_email,
			'name'        => $u->display_name,
			'role'        => $role,
			'roleLabel'   => self::role_label( $role ),
			'isYou'       => (int) $u->ID === get_current_user_id(),
			'registered'  => $u->user_registered,
		];
	}

	public static function role_label( string $role ): string {
		$labels = [
			'administrator' => __( 'Administrador', 'meridian' ),
			'editor'        => __( 'Editor', 'meridian' ),
			'author'        => __( 'Autor', 'meridian' ),
			'contributor'   => __( 'Colaborador', 'meridian' ),
			'subscriber'    => __( 'Suscriptor', 'meridian' ),
		];
		return $labels[ $role ] ?? $role;
	}

	public static function create( array $data ) {
		if ( ! self::can() ) {
			return self::denied();
		}
		$login = sanitize_user( (string) ( $data['login'] ?? '' ), true );
		$email = sanitize_email( (string) ( $data['email'] ?? '' ) );
		$pass  = (string) ( $data['password'] ?? '' );
		$name  = sanitize_text_field( (string) ( $data['name'] ?? $login ) );
		$role  = self::sanitize_role( $data['role'] ?? 'author' );

		if ( strlen( $login ) < 3 ) {
			return self::fail( __( 'El usuario debe tener al menos 3 caracteres.', 'meridian' ) );
		}
		if ( username_exists( $login ) ) {
			return self::fail( __( 'Ese nombre de usuario ya existe.', 'meridian' ) );
		}
		if ( ! is_email( $email ) ) {
			return self::fail( __( 'El correo no es válido.', 'meridian' ) );
		}
		if ( email_exists( $email ) ) {
			return self::fail( __( 'Ese correo ya está en uso.', 'meridian' ) );
		}
		if ( strlen( $pass ) < 8 ) {
			return self::fail( __( 'La contraseña debe tener al menos 8 caracteres.', 'meridian' ) );
		}

		add_filter( 'wp_send_new_user_notification_to_admin', '__return_false', 99 );
		add_filter( 'wp_send_new_user_notification_to_user', '__return_false', 99 );
		$id = wp_insert_user(
			[
				'user_login'   => $login,
				'user_email'   => $email,
				'user_pass'    => $pass,
				'display_name' => $name ?: $login,
				'role'         => $role,
				'nickname'     => $name ?: $login,
			]
		);
		if ( is_wp_error( $id ) ) {
			return self::fail( __( 'No se pudo crear la cuenta.', 'meridian' ) );
		}
		return self::one( get_userdata( (int) $id ) );
	}

	public static function update( int $id, array $data ) {
		if ( ! self::can() ) {
			return self::denied();
		}
		$user = get_userdata( $id );
		if ( ! $user ) {
			return self::fail( __( 'Usuario no encontrado.', 'meridian' ), 404 );
		}

		$role = isset( $data['role'] ) ? self::sanitize_role( $data['role'] ) : ( $user->roles[0] ?? 'subscriber' );
		if ( $role !== ( $user->roles[0] ?? '' ) && self::is_last_admin( $id ) && 'administrator' !== $role ) {
			return self::fail( __( 'No puedes quitar el rol de administrador a la última cuenta admin.', 'meridian' ) );
		}

		$email = isset( $data['email'] ) ? sanitize_email( (string) $data['email'] ) : $user->user_email;
		if ( $email && ! is_email( $email ) ) {
			return self::fail( __( 'El correo no es válido.', 'meridian' ) );
		}
		$other = email_exists( $email );
		if ( $other && (int) $other !== $id ) {
			return self::fail( __( 'Ese correo ya está en uso.', 'meridian' ) );
		}

		$args = [
			'ID'           => $id,
			'user_email'   => $email,
			'display_name' => sanitize_text_field( (string) ( $data['name'] ?? $user->display_name ) ),
			'nickname'     => sanitize_text_field( (string) ( $data['name'] ?? $user->display_name ) ),
		];
		$pass = (string) ( $data['password'] ?? '' );
		if ( $pass !== '' ) {
			if ( strlen( $pass ) < 8 ) {
				return self::fail( __( 'La contraseña debe tener al menos 8 caracteres.', 'meridian' ) );
			}
			$args['user_pass'] = $pass;
		}
		$updated = wp_update_user( $args );
		if ( is_wp_error( $updated ) ) {
			return self::fail( __( 'No se pudo guardar el usuario.', 'meridian' ) );
		}
		$fresh = get_userdata( $id );
		if ( $fresh && ( $fresh->roles[0] ?? '' ) !== $role ) {
			$fresh->set_role( $role );
		}

		if ( isset( $data['login'] ) ) {
			$login = sanitize_user( (string) $data['login'], true );
			if ( $login && $login !== $user->user_login ) {
				if ( strlen( $login ) < 3 ) {
					return self::fail( __( 'El usuario debe tener al menos 3 caracteres.', 'meridian' ) );
				}
				if ( username_exists( $login ) ) {
					return self::fail( __( 'Ese nombre de usuario ya existe.', 'meridian' ) );
				}
				global $wpdb;
				$wpdb->update(
					$wpdb->users,
					[
						'user_login'    => $login,
						'user_nicename' => sanitize_title( $login ),
					],
					[ 'ID' => $id ],
					[ '%s', '%s' ],
					[ '%d' ]
				);
				clean_user_cache( $id );
			}
		}

		return self::one( get_userdata( $id ) );
	}

	public static function delete( int $id ) {
		if ( ! self::can() ) {
			return self::denied();
		}
		if ( $id === get_current_user_id() ) {
			return self::fail( __( 'No puedes eliminar tu propia cuenta.', 'meridian' ) );
		}
		$user = get_userdata( $id );
		if ( ! $user ) {
			return self::fail( __( 'Usuario no encontrado.', 'meridian' ), 404 );
		}
		if ( self::is_last_admin( $id ) ) {
			return self::fail( __( 'No puedes eliminar la última cuenta de administrador.', 'meridian' ) );
		}
		require_once ABSPATH . 'wp-admin/includes/user.php';
		$ok = wp_delete_user( $id, get_current_user_id() );
		if ( ! $ok ) {
			return self::fail( __( 'No se pudo eliminar la cuenta.', 'meridian' ) );
		}
		return [ 'ok' => true ];
	}

	private static function is_last_admin( int $id ): bool {
		$user = get_userdata( $id );
		if ( ! $user || ! in_array( 'administrator', (array) $user->roles, true ) ) {
			return false;
		}
		$admins = get_users( [ 'role' => 'administrator', 'fields' => 'ID' ] );
		return count( $admins ) <= 1;
	}

	private static function sanitize_role( string $role ): string {
		$role = sanitize_key( $role );
		return in_array( $role, self::ROLES, true ) ? $role : 'author';
	}

	private static function fail( string $message, int $status = 400 ): \WP_Error {
		return new \WP_Error( 'meridian_users', $message, [ 'status' => $status ] );
	}

	private static function denied(): \WP_Error {
		return self::fail( __( 'No tienes permiso para gestionar cuentas.', 'meridian' ), 403 );
	}
}
