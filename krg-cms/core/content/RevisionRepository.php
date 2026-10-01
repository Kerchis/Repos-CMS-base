<?php
/**
 * Revisions.
 *
 * @package Meridian
 */

namespace Meridian\Content;

defined( 'ABSPATH' ) || exit;

class RevisionRepository {

	public static function add( int $post_id, string $entity, array $snapshot, string $origin ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'meridian_revisions';
		$json  = wp_json_encode( $snapshot );
		$sum   = hash( 'sha256', $json );
		if ( 'autosave' === $origin ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$last = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT id, checksum, created_at FROM {$table} WHERE post_id = %d AND origin = %s ORDER BY id DESC LIMIT 1",
					$post_id,
					'autosave'
				)
			);
			if ( $last && $last->checksum === $sum ) {
				return;
			}
			if ( $last && ( time() - strtotime( $last->created_at ) ) < 60 ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery
				$wpdb->update(
					$table,
					[
						'snapshot'   => $json,
						'checksum'   => $sum,
						'author_id'  => get_current_user_id(),
						'created_at' => current_time( 'mysql' ),
					],
					[ 'id' => (int) $last->id ]
				);
				return;
			}
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->insert(
			$table,
			[
				'post_id'     => $post_id,
				'entity_type' => sanitize_key( $entity ),
				'snapshot'    => $json,
				'author_id'   => get_current_user_id(),
				'origin'      => sanitize_key( $origin ),
				'checksum'    => $sum,
				'created_at'  => current_time( 'mysql' ),
			]
		);
		self::prune( $post_id );
	}

	public static function list( int $post_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'meridian_revisions';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, origin, author_id, checksum, created_at FROM {$table} WHERE post_id = %d ORDER BY id DESC LIMIT 50",
				$post_id
			)
		);
		$out = [];
		foreach ( $rows ?: [] as $r ) {
			$user  = get_user_by( 'id', $r->author_id );
			$out[] = [
				'id'        => (int) $r->id,
				'origin'    => $r->origin,
				'author'    => $user ? $user->display_name : '',
				'checksum'  => $r->checksum,
				'createdAt' => $r->created_at,
			];
		}
		return $out;
	}

	public static function restore( int $post_id, int $rev_id ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'meridian_revisions';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT snapshot FROM {$table} WHERE id = %d AND post_id = %d", $rev_id, $post_id )
		);
		if ( ! $row ) {
			throw new \RuntimeException( 'not_found' );
		}
		$doc = json_decode( $row->snapshot, true );
		if ( ! is_array( $doc ) ) {
			throw new \RuntimeException( 'invalid' );
		}
		self::add( $post_id, 'page', $doc, 'restore' );
		return PageRepository::save_draft( $post_id, $doc );
	}

	private static function prune( int $post_id ): void {
		global $wpdb;
		$table = $wpdb->prefix . 'meridian_revisions';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$table} WHERE post_id = %d ORDER BY id DESC LIMIT 50 OFFSET 50",
				$post_id
			)
		);
		if ( $ids ) {
			$in = implode( ',', array_map( 'absint', $ids ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "DELETE FROM {$table} WHERE id IN ({$in})" );
		}
	}
}
