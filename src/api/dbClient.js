import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Configuração do Supabase inválida; usando armazenamento local.', error);
  }
}

export { supabase };

// Mapeamento de nomes de tabelas para o Supabase (snake_case)
const TABLE_MAP = {
  Player: 'players',
  Financa: 'financas',
  Compra: 'compras',
  Despesa: 'despesas',
  Banido: 'banidos',
  GcTabela: 'gc_tabelas',
  UserProfile: 'user_profiles',
  AccessRequest: 'access_requests',
  AdminSettings: 'admin_settings',
  SecurityLog: 'security_logs'
};

// Fallback local se o Supabase não tiver chaves preenchidas no ambiente atual
const INITIAL_DATA = {
  Player: [
    { id: 'p1', nick: 'VikingGlitnir', steamid: '76561198000000001', guild: 'Viking', status: 'ativo', duplicado: false, created_date: new Date().toISOString() }
  ],
  Financa: [
    { id: 'f1', nome: 'Doação Inicial', tipo: 'Entrada', valor: 500, data: new Date().toISOString().split('T')[0], observacao: 'Doação de boas-vindas' }
  ],
  Compra: [],
  Despesa: [],
  Banido: [],
  GcTabela: [],
  UserProfile: [],
  AccessRequest: [],
  AdminSettings: [],
  SecurityLog: []
};

const getLocalStorage = (entityName) => {
  const key = `glitnir_db_${entityName}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const initial = INITIAL_DATA[entityName] || [];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try { return JSON.parse(data); } catch { return []; }
};

const setLocalStorage = (entityName, items) => {
  localStorage.setItem(`glitnir_db_${entityName}`, JSON.stringify(items));
};

const createEntityManager = (entityName) => {
  const tableName = TABLE_MAP[entityName] || entityName.toLowerCase();

  return {
    list: async (sortKey, limit) => {
      if (supabase) {
        let query = supabase.from(tableName).select('*');
        if (sortKey) {
          const isDesc = sortKey.startsWith('-');
          const field = isDesc ? sortKey.substring(1) : sortKey;
          query = query.order(field, { ascending: !isDesc });
        }
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw new Error(`Falha ao listar ${tableName}: ${error.message}`);
        return data || [];
      }
      
      let items = getLocalStorage(entityName);
      if (sortKey && sortKey.startsWith('-')) {
        const field = sortKey.substring(1);
        items = [...items].sort((a, b) => (b[field] || '').localeCompare(a[field] || ''));
      }
      return items;
    },

    filter: async (criteria = {}, sortKey, limit) => {
      if (supabase) {
        let query = supabase.from(tableName).select('*');
        Object.entries(criteria).forEach(([k, v]) => {
          query = query.eq(k, v);
        });
        if (sortKey) {
          const isDesc = sortKey.startsWith('-');
          const field = isDesc ? sortKey.substring(1) : sortKey;
          query = query.order(field, { ascending: !isDesc });
        }
        if (limit) query = query.limit(limit);
        const { data, error } = await query;
        if (error) throw new Error(`Falha ao filtrar ${tableName}: ${error.message}`);
        return data || [];
      }

      let items = getLocalStorage(entityName)
        .filter(item => Object.entries(criteria).every(([k, v]) => item[k] === v));
      if (sortKey) {
        const isDesc = sortKey.startsWith('-');
        const field = isDesc ? sortKey.substring(1) : sortKey;
        items = [...items].sort((a, b) => {
          const left = a[field] ?? '';
          const right = b[field] ?? '';
          return isDesc
            ? String(right).localeCompare(String(left))
            : String(left).localeCompare(String(right));
        });
      }
      return limit ? items.slice(0, limit) : items;
    },

    create: async (data) => {
      if (supabase) {
        const { data: inserted, error } = await supabase.from(tableName).insert([data]).select();
        if (error) throw new Error(`Falha ao criar em ${tableName}: ${error.message}`);
        return inserted?.[0] || null;
      }

      const items = getLocalStorage(entityName);
      const newItem = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        created_date: new Date().toISOString(),
        ...data
      };
      items.unshift(newItem);
      setLocalStorage(entityName, items);
      return newItem;
    },

    update: async (id, data) => {
      if (supabase) {
        const { data: updated, error } = await supabase.from(tableName).update(data).eq('id', id).select();
        if (error) throw new Error(`Falha ao atualizar ${tableName}: ${error.message}`);
        return updated?.[0] || null;
      }

      const items = getLocalStorage(entityName);
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
        setLocalStorage(entityName, items);
        return items[index];
      }
      return null;
    },

    delete: async (id) => {
      if (supabase) {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw new Error(`Falha ao excluir de ${tableName}: ${error.message}`);
        return true;
      }

      let items = getLocalStorage(entityName);
      items = items.filter(item => item.id !== id);
      setLocalStorage(entityName, items);
      return true;
    },

    bulkUpdate: async (updates) => {
      if (supabase) {
        for (const { id, data } of updates) {
          const { error } = await supabase.from(tableName).update(data).eq('id', id);
          if (error) throw new Error(`Falha ao atualizar ${tableName}: ${error.message}`);
        }
        return true;
      }

      const items = getLocalStorage(entityName);
      updates.forEach(({ id, data }) => {
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
          items[index] = { ...items[index], ...data };
        }
      });
      setLocalStorage(entityName, items);
      return true;
    },

    subscribe: (onChange) => {
      if (typeof onChange !== 'function' || !supabase) {
        return () => {};
      }

      const channel = supabase
        .channel(`${tableName}-changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          onChange
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  };
};

const entitiesProxy = new Proxy({}, {
  get: (target, prop) => createEntityManager(prop)
});

export const base44 = {
  entities: entitiesProxy,
  analytics: {
    track: () => {}
  },
  auth: {
    me: async () => {
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) return user;
        } catch (e) {}
      }
      const stored = localStorage.getItem('glitnir_local_user');
      return stored ? JSON.parse(stored) : null;
    },
    logout: async () => {
      if (supabase) {
        try { await supabase.auth.signOut(); } catch (e) {}
      }
      localStorage.removeItem('glitnir_local_user');
    },
    redirectToLogin: () => {}
  },
  users: {
    // O convite de usuários exige uma função administrativa no servidor. No
    // modo local, o perfil já é criado pela tela de administração.
    inviteUser: async (email, role = 'user') => ({ email, role, delivered: false })
  },
  integrations: {
    Core: {
      // Não há provedor de e-mail configurado no cliente. Retornar um resultado
      // explícito evita que ações administrativas quebrem enquanto um backend
      // de e-mail não estiver configurado.
      SendEmail: async ({ to, subject }) => ({ to, subject, delivered: false })
    }
  }
};
