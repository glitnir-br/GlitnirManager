import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';


export const queryClientInstance = new QueryClient({
	mutationCache: new MutationCache({
		onError: (error) => {
			toast({
				variant: 'destructive',
				title: 'Não foi possível salvar a alteração',
				description: error?.message || 'Verifique suas permissões no Supabase.'
			});
		}
	}),
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			staleTime: 0,
			retry: 1,
		},
	},
});
