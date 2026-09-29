// Mock client local substituindo a dependência do servidor Base44.
// Salva todas as entidades no localStorage do navegador para persistência local completa.

const INITIAL_DATA = {
  Player: [
    { id: 'p1', nick: 'VikingGlitnir', steamid: '76561198000000001', guild: 'Viking', status: 'ativo', duplicado: false, created_date: new Date().toISOString() },
    { id: 'p2', nick: 'OdinRider', steamid: '76561198000000002', guild: 'Valhalla', status: 'ativo', duplicado: false, created_date: new Date().toISOString() }
  ],
  Financa: [
    { id: 'f1', nome: 'Doação Inicial', tipo: 'Entrada', valor: 500, data: new Date().toISOString().split('T')[0], observacao: 'Doação de boas-vindas' }
  ],
  Compra: [
    { id: 'c1', descricao: 'Pacote Guilda Alfa', valor: 150, data: new Date().toISOString().split('T')[0], comprador: 'VikingGlitnir' }
  ],
  Despesa: [
    { id: 'd1', descricao: 'Servidor VPS Mensal', valor: 200, data: new Date().toISOString().split('T')[0], categoria: 'Infraestrutura' }
  ],
  Banido: [
    { id: 'b1', nick: 'Cheater123', steamid: '76561198999999999', motivo: 'Uso de Hack / Cheating', data_banimento: new Date().toISOString().split('T')[0], banido_por: 'Admin' }
  ],
  GcTabela: [
    { id: 'gc1', nivel: 'Nível 1', valor: 50, recompensa: '1000 Moedas', ordem: 1 },
    { id: 'gc2', nivel: 'Nível 2', valor: 100, recompensa: '2500 Moedas', ordem: 2 }
  ],
  UserProfile: [
    { id: 'u1', full_name: 'Administrador Glitnir', email: 'admin@glitnir.com', role: 'adm_principal', status: 'ativo' }
  ],
  AccessRequest: [],
  AdminSettings: [],
  SecurityLog: []
};

const getStorageEntity = (entityName) => {
  const key = `glitnir_db_${entityName}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const initial = INITIAL_DATA[entityName] || [];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const setStorageEntity = (entityName, items) => {
  const key = `glitnir_db_${entityName}`;
  localStorage.setItem(key, JSON.stringify(items));
};

const createEntityManager = (entityName) => ({
  list: async (sortKey) => {
    let items = getStorageEntity(entityName);
    if (sortKey && sortKey.startsWith('-')) {
      const field = sortKey.substring(1);
      items = [...items].sort((a, b) => (b[field] || '').localeCompare(a[field] || ''));
    }
    return items;
  },
  filter: async (criteria = {}) => {
    const items = getStorageEntity(entityName);
    return items.filter(item => {
      return Object.entries(criteria).every(([key, val]) => item[key] === val);
    });
  },
  create: async (data) => {
    const items = getStorageEntity(entityName);
    const newItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      created_date: new Date().toISOString(),
      ...data
    };
    items.unshift(newItem);
    setStorageEntity(entityName, items);
    return newItem;
  },
  update: async (id, data) => {
    const items = getStorageEntity(entityName);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
      setStorageEntity(entityName, items);
      return items[index];
    }
    return null;
  },
  delete: async (id) => {
    let items = getStorageEntity(entityName);
    items = items.filter(item => item.id !== id);
    setStorageEntity(entityName, items);
    return true;
  },
  bulkUpdate: async (updates) => {
    const items = getStorageEntity(entityName);
    updates.forEach(({ id, data }) => {
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
      }
    });
    setStorageEntity(entityName, items);
    return true;
  }
});

const entitiesProxy = new Proxy({}, {
  get: (target, prop) => createEntityManager(prop)
});

export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      const stored = localStorage.getItem('glitnir_local_user');
      return stored ? JSON.parse(stored) : null;
    },
    logout: () => {
      localStorage.removeItem('glitnir_local_user');
    },
    redirectToLogin: () => {}
  }
};
