import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { USER_ROLES, type UserRole } from '@shared/constants/enums.js';
import type { AuthUser } from '@shared/types/user.js';

import type { ExtendedAxiosError } from '../../api/axios.js';
import { ConfirmModal } from '../../components/admin/ConfirmModal.js';
import { Pagination } from '../../components/admin/Pagination.js';
import { BrutalBadge } from '../../components/brutal/BrutalBadge.js';
import { BrutalButton } from '../../components/brutal/BrutalButton.js';
import { BrutalInput } from '../../components/brutal/BrutalInput.js';
import { AsciiSpinner } from '../../components/feedback/AsciiSpinner.js';
import { EmptyState } from '../../components/feedback/EmptyState.js';
import { ErrorBlock } from '../../components/feedback/ErrorBlock.js';
import { useAuth } from '../../context/AuthContext.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import {
  deleteUser as adminDeleteUser,
  listUsers,
  setUserRole,
  toggleBan,
} from '../../services/admin.service.js';
import { formatRelativeDate } from '../../utils/formatDate.js';
import { resolveAssetUrl } from '../../utils/constants.js';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const ROLE_FILTERS: readonly (UserRole | 'all')[] = ['all', ...USER_ROLES];

const ROLE_TONE: Record<UserRole, 'magenta' | 'electric' | 'acid'> = {
  admin: 'magenta',
  creator: 'electric',
  viewer: 'acid',
};

export const AdminUsersPage = () => {
  const { user: me } = useAuth();
  const [items, setItems] = useState<AuthUser[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(
    null
  );

  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (roleFilter !== 'all') params.role = roleFilter;

    (async () => {
      try {
        const data = await listUsers(params);
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        const axiosErr = err as ExtendedAxiosError;
        setError({
          message:
            axiosErr.response?.data?.message ?? axiosErr.message ?? 'Failed to load users',
          ...(axiosErr.requestId ? { requestId: axiosErr.requestId } : {}),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, roleFilter, reloadToken]);

  const isSelf = (target: AuthUser): boolean => me?._id === target._id;

  const handleRoleChange = async (target: AuthUser, nextRole: UserRole) => {
    if (target.role === nextRole) return;
    if (isSelf(target)) {
      toast.error('// CANNOT MODIFY SELF');
      return;
    }
    setPendingActionId(target._id);
    try {
      const result = await setUserRole(target._id, nextRole);
      setItems((current) =>
        current.map((user) =>
          user._id === target._id ? { ...user, role: result.role } : user
        )
      );
      toast.success(`// ROLE UPDATED // ${target.username} -> ${result.role.toUpperCase()}`);
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      toast.error(
        `// ROLE FAILED // ${axiosErr.response?.data?.message ?? axiosErr.message ?? 'unknown'}`
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const handleToggleBan = async (target: AuthUser) => {
    if (isSelf(target)) {
      toast.error('// CANNOT MODIFY SELF');
      return;
    }
    setPendingActionId(target._id);
    try {
      const result = await toggleBan(target._id, !target.isBanned);
      setItems((current) =>
        current.map((user) =>
          user._id === target._id ? { ...user, isBanned: result.isBanned } : user
        )
      );
      toast.success(
        result.isBanned
          ? `// USER BANNED // ${target.username}`
          : `// USER UNBANNED // ${target.username}`
      );
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      toast.error(
        `// BAN FAILED // ${axiosErr.response?.data?.message ?? axiosErr.message ?? 'unknown'}`
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (isSelf(deleteTarget)) {
      toast.error('// CANNOT MODIFY SELF');
      setDeleteTarget(null);
      return;
    }
    setPendingActionId(deleteTarget._id);
    try {
      const result = await adminDeleteUser(deleteTarget._id);
      setItems((current) => current.filter((user) => user._id !== deleteTarget._id));
      setTotal((value) => Math.max(0, value - 1));
      toast.success(
        `// USER ERASED // ${deleteTarget.username} // -${result.videosDeleted} VIDEOS`
      );
      setDeleteTarget(null);
    } catch (err) {
      const axiosErr = err as ExtendedAxiosError;
      toast.error(
        `// DELETE FAILED // ${axiosErr.response?.data?.message ?? axiosErr.message ?? 'unknown'}`
      );
    } finally {
      setPendingActionId(null);
    }
  };

  const renderRoleSelect = (target: AuthUser) => {
    const disabled = isSelf(target) || pendingActionId === target._id;
    return (
      <select
        aria-label={`Change role for ${target.username}`}
        value={target.role}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          handleRoleChange(target, event.target.value as UserRole)
        }
        className="border-2 border-ink bg-bone p-1 font-mono text-xs uppercase text-ink dark:bg-ink dark:text-bone disabled:opacity-50"
      >
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    );
  };

  const renderTableBody = () => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="border-2 border-ink p-0">
            <EmptyState
              title="// NO USERS FOUND"
              description="adjust the filters or search query."
            />
          </td>
        </tr>
      );
    }

    return items.map((user) => {
      const avatar = resolveAssetUrl(user.avatarUrl);
      const self = isSelf(user);
      const busy = pendingActionId === user._id;
      return (
        <tr key={user._id} className="border-2 border-ink align-middle hover:bg-acid/10">
          <td className="border-r-2 border-ink p-2">
            <div className="size-10 overflow-hidden border-2 border-ink bg-ink/80">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase text-bone/60">
                  --
                </div>
              )}
            </div>
          </td>
          <td className="border-r-2 border-ink p-2 align-middle">
            <Link
              to={`/c/${user.username}`}
              className="font-mono text-sm uppercase hover:underline"
            >
              @{user.username}
            </Link>
            {self && (
              <span className="ms-2 font-mono text-[10px] uppercase text-acid">
                [ YOU ]
              </span>
            )}
          </td>
          <td className="border-r-2 border-ink p-2 font-mono text-xs">{user.email}</td>
          <td className="border-r-2 border-ink p-2">
            <BrutalBadge tone={ROLE_TONE[user.role]}>{user.role}</BrutalBadge>
          </td>
          <td className="border-r-2 border-ink p-2">
            {user.isBanned ? (
              <BrutalBadge tone="orange">BANNED</BrutalBadge>
            ) : (
              <BrutalBadge tone="ink">ACTIVE</BrutalBadge>
            )}
          </td>
          <td className="border-r-2 border-ink p-2 text-right font-mono text-xs uppercase">
            {formatRelativeDate(user.createdAt)}
          </td>
          <td className="p-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {renderRoleSelect(user)}
              <BrutalButton
                size="sm"
                variant={user.isBanned ? 'outline' : 'danger'}
                disabled={self || busy}
                onClick={() => handleToggleBan(user)}
              >
                {user.isBanned ? 'UNBAN' : 'BAN'}
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="danger"
                disabled={self || busy}
                onClick={() => setDeleteTarget(user)}
              >
                DELETE
              </BrutalButton>
            </div>
          </td>
        </tr>
      );
    });
  };

  const totalLabel = useMemo(
    () => (loading ? 'LOADING...' : `${total} USERS`),
    [loading, total]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-6 flex flex-col gap-1">
        <span className="font-mono text-xs uppercase opacity-60">
          // FRAGMENT // CONTROL ROOM
        </span>
        <h1 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
          // ADMIN // USERS
        </h1>
        <p className="font-mono text-xs uppercase opacity-70">
          {'>>'} moderate the entire user base
        </p>
      </header>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <BrutalInput
          label="SEARCH"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="// username or email"
          prefix=">"
        />

        <div className="flex flex-col gap-1 font-mono">
          <label
            htmlFor="admin-users-role"
            className="text-xs uppercase tracking-tight text-ink dark:text-bone"
          >
            // ROLE
          </label>
          <select
            id="admin-users-role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as UserRole | 'all')}
            className="border-2 border-ink bg-bone p-2 font-mono text-sm uppercase text-ink dark:bg-ink dark:text-bone"
          >
            {ROLE_FILTERS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="font-mono text-xs uppercase opacity-60 md:pb-2">
          {totalLabel}
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBlock
            message={error.message}
            {...(error.requestId ? { requestId: error.requestId } : {})}
            onRetry={() => setReloadToken((value) => value + 1)}
          />
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <AsciiSpinner label="LOADING USERS" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse border-2 border-ink font-mono text-sm">
              <thead className="bg-ink text-acid">
                <tr>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // AVATAR
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // USERNAME
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // EMAIL
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // ROLE
                  </th>
                  <th className="border-2 border-ink p-2 text-left text-xs uppercase">
                    // STATUS
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // JOINED
                  </th>
                  <th className="border-2 border-ink p-2 text-right text-xs uppercase">
                    // ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>
          </div>

          <div className="mt-6">
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              disabled={loading}
            />
          </div>
        </>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="DELETE USER"
        destructive
        loading={pendingActionId !== null && pendingActionId === deleteTarget?._id}
        confirmLabel="DELETE FOREVER"
        acknowledgeLabel="I UNDERSTAND THIS IS PERMANENT"
        description={
          deleteTarget ? (
            <>
              {'>>'} this will erase{' '}
              <strong className="font-bold">@{deleteTarget.username}</strong>,
              every video they uploaded and all their reactions. cannot be undone.
            </>
          ) : (
            ''
          )
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
};

export default AdminUsersPage;
