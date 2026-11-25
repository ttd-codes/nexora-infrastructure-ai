import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { seedCampusDemoDataset } from '../lib/demoSeed';
import {
  subscribeOwnerCollection,
  syncUserProfile,
} from '../services/firestoreService';
import {
  ActiveModule,
  Asset,
  CampusLocation,
  DocumentRecord,
  MaintenanceRecord,
  NotificationItem,
  Recommendation,
  RuleConfig,
  UserProfile,
} from '../types/nexora';

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface WorkspaceContextValue {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  dataLoading: boolean;
  seeding: boolean;
  activeModule: ActiveModule;
  setActiveModule: (mod: ActiveModule) => void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  selectedRecommendationId: string | null;
  setSelectedRecommendationId: (id: string | null) => void;
  locations: CampusLocation[];
  assets: Asset[];
  records: MaintenanceRecord[];
  documents: DocumentRecord[];
  recommendations: Recommendation[];
  notifications: NotificationItem[];
  ruleConfigs: RuleConfig[];
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  reseedDemoWorkspace: () => Promise<void>;
  openAssetDetail: (assetId: string) => void;
  openInvestigation: (recommendationId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [activeModule, setActiveModule] = useState<ActiveModule>('command-center');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null);

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [ruleConfigs, setRuleConfigs] = useState<RuleConfig[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const seededAttemptedRef = useRef<Set<string>>(new Set());

  const pushToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const prof = await syncUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || 'Facility Engineer'
          );
          setProfile(prof);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setProfile(null);
        setLocations([]);
        setAssets([]);
        setRecords([]);
        setDocuments([]);
        setRecommendations([]);
        setNotifications([]);
        setRuleConfigs([]);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    let assetsResolved = false;

    const unsubLocations = subscribeOwnerCollection<CampusLocation>('locations', user.uid, setLocations);
    const unsubAssets = subscribeOwnerCollection<Asset>('assets', user.uid, async (items) => {
      setAssets(items);
      if (!assetsResolved) {
        assetsResolved = true;
        setDataLoading(false);
      }
      if (items.length === 0 && !seededAttemptedRef.current.has(user.uid)) {
        seededAttemptedRef.current.add(user.uid);
        setSeeding(true);
        try {
          await seedCampusDemoDataset(user.uid);
          pushToast({
            title: 'Campus Demonstration Dataset Initialized',
            detail: 'Fictional campus assets (P-104, G-201, AC-302, E-401, EP-501) loaded into Firestore.',
            tone: 'info',
          });
        } catch (err) {
          console.error('Seed error:', err);
        } finally {
          setSeeding(false);
        }
      }
    });
    const unsubRecords = subscribeOwnerCollection<MaintenanceRecord>('maintenanceRecords', user.uid, setRecords);
    const unsubDocs = subscribeOwnerCollection<DocumentRecord>('documents', user.uid, setDocuments);
    const unsubRecs = subscribeOwnerCollection<Recommendation>('recommendations', user.uid, setRecommendations);
    const unsubNotifs = subscribeOwnerCollection<NotificationItem>('notifications', user.uid, setNotifications);
    const unsubRules = subscribeOwnerCollection<RuleConfig>('ruleConfigs', user.uid, setRuleConfigs);

    return () => {
      unsubLocations();
      unsubAssets();
      unsubRecords();
      unsubDocs();
      unsubRecs();
      unsubNotifs();
      unsubRules();
    };
  }, [user]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      pushToast({
        title: 'Sign-In Interrupted',
        detail: msg,
        tone: 'error',
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
    setActiveModule('command-center');
    setSelectedAssetId(null);
    setSelectedRecommendationId(null);
  };

  const reseedDemoWorkspace = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedCampusDemoDataset(user.uid);
      pushToast({
        title: 'Demo Dataset Refreshed',
        detail: 'Sample campus records and P-104 history restored.',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Refresh Failed',
        detail: err instanceof Error ? err.message : 'Unable to seed sample dataset.',
        tone: 'error',
      });
    } finally {
      setSeeding(false);
    }
  };

  const openAssetDetail = (assetId: string) => {
    setSelectedAssetId(assetId);
    setActiveModule('assets');
  };

  const openInvestigation = (recommendationId: string) => {
    setSelectedRecommendationId(recommendationId);
    setActiveModule('investigation-center');
  };

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        profile,
        authLoading,
        dataLoading,
        seeding,
        activeModule,
        setActiveModule,
        selectedAssetId,
        setSelectedAssetId,
        selectedRecommendationId,
        setSelectedRecommendationId,
        locations,
        assets,
        records,
        documents,
        recommendations,
        notifications,
        ruleConfigs,
        toasts,
        pushToast,
        dismissToast,
        loginWithGoogle,
        logout,
        reseedDemoWorkspace,
        openAssetDetail,
        openInvestigation,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return ctx;
}
