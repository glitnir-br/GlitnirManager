// An exception after dispatch cannot prove whether the game executed the command.
export async function executeDelivery({ execute, server, command, persist }) {
  let response;
  try {
    response = await execute(server, command);
  } catch (error) {
    await persist({ status: 'resultado_incerto', error: error.message }).catch(() => {});
    return { status: 'resultado_incerto' };
  }
  const failed = /(error|failed|failure|not found|offline|invalid|exception|erro|falhou|não encontrado|nao encontrado)/i.test(response);
  const status = response === 'Comando executado sem resposta.' ? 'resultado_incerto' : failed ? 'falhou' : 'entregue';
  try {
    const delivery = await persist({ status, response });
    return { status, delivery };
  } catch {
    return { status: 'resultado_incerto' };
  }
}
