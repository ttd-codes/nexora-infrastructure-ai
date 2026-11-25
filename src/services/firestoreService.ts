import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Asset,
  CampusLocation,
  DocumentRecord,
  MaintenanceRecord,
  NotificationItem,
  Recommendation,
  RuleConfig,
  UserProfile,
} from '../types/nexora';

export function makeSafeDocId(uid: string, prefix: string): string {
  const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanUid}_${prefix}_${Date.now().toString(36)}_${rand}`.slice(0, 120);
}

export async function syncUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const role = email === 'thiviyadarshan2007@gmail.com' ? 'admin' : 'engineer';
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const profile: UserProfile = {
        uid,
        email,
        displayName: displayName.slice(0, 120) || email.split('@')[0],
        role,
        organizationName: 'Northbridge Institute of Technology (Campus Demo)',
      };
      await setDoc(userRef, {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return profile;
    } else {
      const data = snap.data() as UserProfile;
      return data;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export function subscribeOwnerCollection<T extends { id: string }>(
  collectionName: string,
  uid: string,
  onData: (items: T[]) => void
): Unsubscribe {
  const q = query(collection(db, collectionName), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as T[];
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

export async function createLocation(
  uid: string,
  input: Omit<CampusLocation, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeSafeDocId(uid, 'loc');
  try {
    await setDoc(doc(db, 'locations', id), {
      name: input.name.slice(0, 120),
      buildingCode: input.buildingCode.slice(0, 32),
      facilityType: (input.facilityType || '').slice(0, 80),
      zoneDescription: (input.zoneDescription || '').slice(0, 500),
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `locations/${id}`);
  }
}

export async function createAsset(
  uid: string,
  input: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeSafeDocId(uid, 'asset');
  try {
    await setDoc(doc(db, 'assets', id), {
      assetCode: input.assetCode.slice(0, 40),
      name: input.name.slice(0, 140),
      category: input.category,
      locationId: input.locationId,
      locationName: input.locationName.slice(0, 120),
      installDate: (input.installDate || '').slice(0, 32),
      manufacturer: (input.manufacturer || '').slice(0, 120),
      modelNumber: (input.modelNumber || '').slice(0, 100),
      status: input.status,
      description: (input.description || '').slice(0, 2000),
      components: input.components.slice(0, 25).map((c) => c.slice(0, 300)),
      imageUrl: (input.imageUrl || '').slice(0, 500),
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `assets/${id}`);
  }
}

export async function updateAsset(
  assetId: string,
  updates: Partial<Omit<Asset, 'id' | 'ownerUid' | 'isDemoData' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'assets', assetId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `assets/${assetId}`);
  }
}

export async function deleteAssetAndLinkedData(uid: string, assetId: string): Promise<void> {
  try {
    const recSnap = await getDocs(
      query(
        collection(db, 'maintenanceRecords'),
        where('ownerUid', '==', uid),
        where('assetId', '==', assetId)
      )
    );
    const recoSnap = await getDocs(
      query(
        collection(db, 'recommendations'),
        where('ownerUid', '==', uid),
        where('assetId', '==', assetId)
      )
    );
    const batch = writeBatch(db);
    recSnap.forEach((d) => batch.delete(d.ref));
    recoSnap.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'assets', assetId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `assets/${assetId}`);
  }
}

export async function createMaintenanceRecord(
  uid: string,
  input: Omit<MaintenanceRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeSafeDocId(uid, 'rec');
  try {
    await setDoc(doc(db, 'maintenanceRecords', id), {
      recordCode: input.recordCode.slice(0, 40),
      assetId: input.assetId,
      assetCode: input.assetCode.slice(0, 40),
      assetName: input.assetName.slice(0, 140),
      locationName: (input.locationName || '').slice(0, 120),
      incidentDate: input.incidentDate.slice(0, 32),
      category: input.category,
      recordType: input.recordType,
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 3000),
      symptoms: input.symptoms.slice(0, 15).map((s) => s.slice(0, 300)),
      repairAction: (input.repairAction || '').slice(0, 2000),
      componentInvolved: (input.componentInvolved || '').slice(0, 120),
      technicianName: (input.technicianName || '').slice(0, 120),
      status: input.status,
      inspectionStatus: input.inspectionStatus,
      sourceDocumentId: (input.sourceDocumentId || '').slice(0, 128),
      sourceDocumentName: (input.sourceDocumentName || '').slice(0, 200),
      confidence: typeof input.confidence === 'number' ? Math.min(1, Math.max(0, input.confidence)) : 1,
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `maintenanceRecords/${id}`);
  }
}

export async function updateMaintenanceRecord(
  recordId: string,
  updates: Partial<Omit<MaintenanceRecord, 'id' | 'ownerUid' | 'recordCode' | 'isDemoData' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'maintenanceRecords', recordId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `maintenanceRecords/${recordId}`);
  }
}

export async function deleteMaintenanceRecord(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'maintenanceRecords', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `maintenanceRecords/${recordId}`);
  }
}

export async function createDocumentRecord(
  uid: string,
  input: Omit<DocumentRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeSafeDocId(uid, 'doc');
  try {
    await setDoc(doc(db, 'documents', id), {
      fileName: input.fileName.slice(0, 200),
      fileType: input.fileType,
      mimeType: (input.mimeType || '').slice(0, 120),
      fileSize: input.fileSize || 0,
      assetId: (input.assetId || '').slice(0, 128),
      assetCode: (input.assetCode || '').slice(0, 40),
      extractionStatus: input.extractionStatus,
      extractedSummary: (input.extractedSummary || '').slice(0, 2000),
      rawTextSnippet: (input.rawTextSnippet || '').slice(0, 4000),
      previewUrl: (input.previewUrl || '').slice(0, 500),
      uncertainFields: input.uncertainFields.slice(0, 15).map((f) => f.slice(0, 300)),
      confirmedByUser: input.confirmedByUser,
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `documents/${id}`);
  }
}

export async function saveRecommendation(
  uid: string,
  docId: string,
  input: Omit<Recommendation, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const safeId = `${uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12)}_${docId.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 120);
  try {
    const ref = doc(db, 'recommendations', safeId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await deleteDoc(ref);
    }
    await setDoc(ref, {
      title: input.title.slice(0, 240),
      assetId: input.assetId,
      assetCode: input.assetCode.slice(0, 40),
      assetName: input.assetName.slice(0, 140),
      ruleTriggered: input.ruleTriggered.slice(0, 120),
      ruleDescription: (input.ruleDescription || '').slice(0, 500),
      severity: input.severity,
      observedFacts: input.observedFacts.slice(0, 20).map((f) => f.slice(0, 300)),
      interpretation: input.interpretation.slice(0, 2000),
      missingInformation: input.missingInformation.slice(0, 15).map((m) => m.slice(0, 300)),
      suggestedActions: input.suggestedActions.slice(0, 15).map((a) => a.slice(0, 300)),
      supportingRecordIds: input.supportingRecordIds.slice(0, 25),
      contradictoryRecordIds: input.contradictoryRecordIds.slice(0, 15),
      evidenceCompleteness: Math.min(100, Math.max(0, Math.round(input.evidenceCompleteness))),
      status: input.status,
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `recommendations/${safeId}`);
  }
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: Recommendation['status']
): Promise<void> {
  try {
    await updateDoc(doc(db, 'recommendations', recommendationId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recommendations/${recommendationId}`);
  }
}

export async function createNotification(
  uid: string,
  input: Omit<NotificationItem, 'id' | 'ownerUid' | 'createdAt'>
): Promise<void> {
  const id = makeSafeDocId(uid, 'notif');
  try {
    await setDoc(doc(db, 'notifications', id), {
      title: input.title.slice(0, 180),
      message: input.message.slice(0, 600),
      severity: input.severity,
      assetId: (input.assetId || '').slice(0, 128),
      recommendationId: (input.recommendationId || '').slice(0, 128),
      read: input.read,
      isDemoData: input.isDemoData,
      ownerUid: uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${id}`);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function updateRuleConfig(
  ruleId: string,
  updates: Pick<RuleConfig, 'thresholdCount' | 'windowDays' | 'enabled'>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'ruleConfigs', ruleId), {
      thresholdCount: updates.thresholdCount,
      windowDays: updates.windowDays,
      enabled: updates.enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ruleConfigs/${ruleId}`);
  }
}
