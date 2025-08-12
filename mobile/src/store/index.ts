import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import scanSlice from './slices/scanSlice';
import rackSlice from './slices/rackSlice';
import syncSlice from './slices/syncSlice';
import appSlice from './slices/appSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    scans: scanSlice,
    racks: rackSlice,
    sync: syncSlice,
    app: appSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disable for development debugging
      immutableCheck: false, // Disable for development debugging
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;