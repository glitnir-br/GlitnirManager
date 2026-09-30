let confirmationHandler = null;

export const setDeleteConfirmationHandler = (handler) => {
  confirmationHandler = handler;
};

export const requestDeleteConfirmation = () =>
  confirmationHandler ? confirmationHandler() : Promise.resolve(false);
