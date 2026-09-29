import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
    list: async (sortKey) => {
      if (supabase) {
        try {
          let query = supabase.from(tableName).select('*');
          if (sortKey) {
            const isDesc = sortKey.startsWith('-');
            const field = isDesc ? sortKey.substring(1) : sortKey;
            query = query.order(field, { ascending: !isDesc });
          }
          const { data, error } = await query;
          if (!error && data) return data;
        } catch (e) {
          console.warn(`Supabase list error for ${tableName}, fallback to local:`, e);
        }
      }
      
      let items = getLocalStorage(entityName);
      if (sortKey && sortKey.startsWith('-')) {
        const field = sortKey.substring(1);
        items = [...items].sort((a, b) => (b[field] || '').localeCompare(a[field] || ''));
      }
      return items;
    },

    filter: async (criteria = {}) => {
      if (supabase) {
        try {
          let query = supabase.from(tableName).select('*');
          Object.entries(criteria).forEach(([k, v]) => {
            query = query.eq(k, v);
          });
          const { data, error } = await query;
          if (!error && data) return data;
        } catch (e) {
          console.warn(`Supabase filter error for ${tableName}:`, e);
        }
      }

      const items = getLocalStorage(entityName);
      return items.filter(item => Object.entries(criteria).every(([k, v]) => item[k] === v));
    },

    create: async (data) => {
      if (supabase) {
        try {
          const { data: inserted, error } = await supabase.from(tableName).insert([data]).select();
          if (!error && inserted && inserted[0]) return inserted[0];
        } catch (e) {
          console.warn(`Supabase create error for ${tableName}:`, e);
        }
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
        try {
          const { data: updated, error } = await supabase.from(tableName).update(data).eq('id', id).select();
          if (!error && updated && updated[0]) return updated[0];
        } catch (e) {
          console.warn(`Supabase update error for ${tableName}:`, e);
        }
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
        try {
          const { error } = await supabase.from(tableName).delete().eq('id', id);
          if (!error) return true;
        } catch (e) {
          console.warn(`Supabase delete error for ${tableName}:`, e);
        }
      }

      let items = getLocalStorage(entityName);
      items = items.filter(item => item.id !== id);
      setLocalStorage(entityName, items);
      return true;
    },

    bulkUpdate: async (updates) => {
      if (supabase) {
        try {
          for (const { id, data } of updates) {
            await supabase.from(tableName).update(data).eq('id', id);
          }
          return true;
        } catch (e) {
          console.warn(`Supabase bulkUpdate error for ${tableName}:`, e);
        }
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
    }
  };
};

const entitiesProxy = new Proxy({}, {
  get: (target, prop) => createEntityManager(prop)
});

export const base44 = {
  entities: entitiesProxy,
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
  }
};
