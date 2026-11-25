import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

function makeId(uid: string, suffix: string): string {
  const prefix = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12);
  return `${prefix}_${suffix}`;
}

export async function seedCampusDemoDataset(uid: string): Promise<void> {
  // Clean up any existing demo documents owned by this user so re-seeding uses fresh allow create writes
  const demoCollections = [
    'notifications',
    'recommendations',
    'maintenanceRecords',
    'documents',
    'ruleConfigs',
    'assets',
    'locations',
  ];
  for (const colName of demoCollections) {
    const snap = await getDocs(query(collection(db, colName), where('ownerUid', '==', uid)));
    const toDelete = snap.docs.filter((d) => colName === 'ruleConfigs' || d.data().isDemoData === true);
    if (toDelete.length > 0) {
      const delBatch = writeBatch(db);
      toDelete.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  }

  const locBlockA = makeId(uid, 'loc_block_a');
  const locMain = makeId(uid, 'loc_main_bldg');
  const locLab = makeId(uid, 'loc_comp_lab');
  const locBlockB = makeId(uid, 'loc_block_b');

  const assetP104 = makeId(uid, 'asset_P-104');
  const assetG201 = makeId(uid, 'asset_G-201');
  const assetAC302 = makeId(uid, 'asset_AC-302');
  const assetE401 = makeId(uid, 'asset_E-401');
  const assetEP501 = makeId(uid, 'asset_EP-501');

  const docLogP104 = makeId(uid, 'doc_p104_logbook');
  const docGenService = makeId(uid, 'doc_g201_report');
  const docAcInspect = makeId(uid, 'doc_ac302_sheet');

  const rec1 = makeId(uid, 'rec_1041');
  const rec2 = makeId(uid, 'rec_1042');
  const rec3 = makeId(uid, 'rec_1043');
  const rec4 = makeId(uid, 'rec_2011');
  const rec5 = makeId(uid, 'rec_2012');
  const rec6 = makeId(uid, 'rec_3021');
  const rec7 = makeId(uid, 'rec_3022');
  const rec8 = makeId(uid, 'rec_4011');
  const rec9 = makeId(uid, 'rec_5011');

  const recFindingP104 = makeId(uid, 'rec_finding_P-104');
  const recFindingAC302 = makeId(uid, 'rec_finding_AC-302');

  try {
    // Batch 1: Locations (parent collection required before assets exist)
    const batch1 = writeBatch(db);
    const locations = [
      {
        id: locBlockA,
        name: 'Block A — Academic & Hydraulics Wing',
        buildingCode: 'BLK-A',
        facilityType: 'Utility & Academic Building',
        zoneDescription: 'Houses domestic water booster pumps, chilled water risers, and ground mechanical bay.',
      },
      {
        id: locMain,
        name: 'Main Building — Administration & Core Power',
        buildingCode: 'MAIN',
        facilityType: 'Central Campus Facility',
        zoneDescription: 'Primary campus electrical switchgear room and standby diesel generation bay.',
      },
      {
        id: locLab,
        name: 'Computer Lab — Engineering Annex',
        buildingCode: 'CS-LAB',
        facilityType: 'Precision Cooling & Server Zone',
        zoneDescription: 'High-density workstation laboratories and precision cooling condenser deck.',
      },
      {
        id: locBlockB,
        name: 'Block B — Lecture & Vertical Transit Wing',
        buildingCode: 'BLK-B',
        facilityType: 'Multi-Story Academic Block',
        zoneDescription: 'Four-story lecture complex served by passenger and freight traction elevators.',
      },
    ];

    for (const loc of locations) {
      batch1.set(doc(db, 'locations', loc.id), {
        name: loc.name,
        buildingCode: loc.buildingCode,
        facilityType: loc.facilityType,
        zoneDescription: loc.zoneDescription,
        isDemoData: true,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch1.commit();

    // Batch 2: Assets (must commit before maintenanceRecords & recommendations reference them)
    const batch2 = writeBatch(db);
    const assets = [
      {
        id: assetP104,
        assetCode: 'P-104',
        name: 'Water Pump',
        category: 'Water Supply',
        locationId: locBlockA,
        locationName: 'Block A — Academic & Hydraulics Wing',
        installDate: '2021-06-15',
        manufacturer: 'Grundfos / WEG',
        modelNumber: 'CR-45-3-A-F-A-E',
        status: 'Attention Required',
        description: 'Primary centrifugal booster pump supplying Block A upper laboratories and chilled loop makeup.',
        components: ['Drive Bearing (P-104-B)', 'Mechanical Shaft Seal', 'Flexible Coupling', 'Impeller Assembly', '15kW Induction Motor'],
        imageUrl: '/src/assets/images/asset_water_pump_1795607873423.jpg',
      },
      {
        id: assetG201,
        assetCode: 'G-201',
        name: 'Backup Generator',
        category: 'Electrical',
        locationId: locMain,
        locationName: 'Main Building — Administration & Core Power',
        installDate: '2020-11-04',
        manufacturer: 'Caterpillar Power Systems',
        modelNumber: 'CAT-C18-800kW',
        status: 'Operational',
        description: '800 kW diesel standby generator providing automatic failover power to Main Building and server racks.',
        components: ['Automatic Voltage Regulator (AVR)', 'Starter Battery Bank', 'Fuel Injection Pump', 'Automatic Transfer Switch'],
        imageUrl: '/src/assets/images/asset_generator_1795607873194.jpg',
      },
      {
        id: assetAC302,
        assetCode: 'AC-302',
        name: 'Air Conditioning Unit',
        category: 'Cooling Systems',
        locationId: locLab,
        locationName: 'Computer Lab — Engineering Annex',
        installDate: '2022-03-19',
        manufacturer: 'York Industrial HVAC',
        modelNumber: 'YVAA-0280-Chiller',
        status: 'Under Maintenance',
        description: 'Rooftop air-cooled chiller maintaining 21°C ambient setpoint for the 120-seat Computer Lab.',
        components: ['Scroll Compressor B', 'Condenser Fan Motor', 'Thermal Expansion Valve', 'Refrigerant Filter Drier'],
        imageUrl: '/src/assets/images/asset_hvac_chiller_1795607872832.jpg',
      },
      {
        id: assetE401,
        assetCode: 'E-401',
        name: 'Elevator',
        category: 'Mechanical',
        locationId: locBlockB,
        locationName: 'Block B — Lecture & Vertical Transit Wing',
        installDate: '2019-08-22',
        manufacturer: 'Otis Transit Systems',
        modelNumber: 'Gen2-MRL-1600',
        status: 'Operational',
        description: '4-stop machine-room-less traction passenger elevator serving Block B lecture halls.',
        components: ['Door Operator Motor', 'Traction Sheave', 'Optical Leveling Sensor', 'Hoistway Safety Interlock'],
        imageUrl: '',
      },
      {
        id: assetEP501,
        assetCode: 'EP-501',
        name: 'Electrical Panel',
        category: 'Electrical',
        locationId: locMain,
        locationName: 'Main Building — Administration & Core Power',
        installDate: '2020-09-10',
        manufacturer: 'Siemens Energy',
        modelNumber: 'SIVACON-S8-800A',
        status: 'Operational',
        description: 'Main 415V three-phase distribution switchboard feeding Main Building risers and lab sub-panels.',
        components: ['Main Air Circuit Breaker 800A', 'Copper Busbar Assembly', 'Surge Protection Device', 'Digital Power Meter'],
        imageUrl: '',
      },
    ];

    for (const asset of assets) {
      batch2.set(doc(db, 'assets', asset.id), {
        assetCode: asset.assetCode,
        name: asset.name,
        category: asset.category,
        locationId: asset.locationId,
        locationName: asset.locationName,
        installDate: asset.installDate,
        manufacturer: asset.manufacturer,
        modelNumber: asset.modelNumber,
        status: asset.status,
        description: asset.description,
        components: asset.components,
        imageUrl: asset.imageUrl,
        isDemoData: true,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch2.commit();

    // Batch 3: Documents, Maintenance Records, Recommendations, Notifications, Rule Configs
    const batch3 = writeBatch(db);

    const sampleDocs = [
      {
        id: docLogP104,
        fileName: 'BlockA_Pump_P104_Handwritten_Register.jpg',
        fileType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 482400,
        assetId: assetP104,
        assetCode: 'P-104',
        extractionStatus: 'Confirmed',
        extractedSummary: 'Handwritten Block A register recording three vibration/noise events on Water Pump P-104 (Jan 12, Mar 08, Apr 26).',
        rawTextSnippet: 'Jan 12: Excessive vibration reported during operation. Bearing adjusted & greased. | Mar 08: Unusual grinding noise heard from pump. Drive bearing (P-104-B) replaced with SKF unit. | Apr 26: Vibration returned during peak load. Minor shaft misalignment found.',
        previewUrl: '/src/assets/images/sample_maintenance_log_1795607874096.jpg',
        uncertainFields: [],
        confirmedByUser: true,
      },
      {
        id: docGenService,
        fileName: 'G201_LoadBank_Inspection_Q1.pdf',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSize: 314800,
        assetId: assetG201,
        assetCode: 'G-201',
        extractionStatus: 'Confirmed',
        extractedSummary: 'Quarterly 80% load bank test and AVR voltage stability calibration report for Backup Generator G-201.',
        rawTextSnippet: 'Load test 640 kW sustained for 60 minutes. Output voltage steady at 415V ±0.8%. Starter battery resting voltage 25.4V.',
        previewUrl: '',
        uncertainFields: [],
        confirmedByUser: true,
      },
      {
        id: docAcInspect,
        fileName: 'AC302_Compressor_Thermal_Note.txt',
        fileType: 'text',
        mimeType: 'text/plain',
        fileSize: 4210,
        assetId: assetAC302,
        assetCode: 'AC-302',
        extractionStatus: 'Confirmed',
        extractedSummary: 'Technician field note reporting condenser coil fouling and elevated discharge pressure on AC-302.',
        rawTextSnippet: 'Computer Lab chiller AC-302 tripping on high head pressure during afternoon peak. Condenser coil fin wash and refrigerant subcooling check logged.',
        previewUrl: '',
        uncertainFields: [],
        confirmedByUser: true,
      },
    ];

    for (const d of sampleDocs) {
      batch3.set(doc(db, 'documents', d.id), {
        fileName: d.fileName,
        fileType: d.fileType,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        assetId: d.assetId,
        assetCode: d.assetCode,
        extractionStatus: d.extractionStatus,
        extractedSummary: d.extractedSummary,
        rawTextSnippet: d.rawTextSnippet,
        previewUrl: d.previewUrl,
        uncertainFields: d.uncertainFields,
        confirmedByUser: d.confirmedByUser,
        isDemoData: true,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const records = [
      {
        id: rec1,
        recordCode: 'REC-1041',
        assetId: assetP104,
        assetCode: 'P-104',
        assetName: 'Water Pump',
        locationName: 'Block A — Academic & Hydraulics Wing',
        incidentDate: '2026-01-12',
        category: 'Water Supply',
        recordType: 'Incident',
        title: 'Excessive vibration reported during operation',
        description: 'Operators reported pronounced casing vibration on Block A Water Pump P-104 during morning supply cycle. Slight wear noted on drive bearing.',
        symptoms: ['Excessive vibration'],
        repairAction: 'Bearing adjustment and re-lubrication performed; unit retested within normal limits.',
        componentInvolved: 'Drive Bearing (P-104-B)',
        technicianName: 'M. Thompson',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: docLogP104,
        sourceDocumentName: 'BlockA_Pump_P104_Handwritten_Register.jpg',
        confidence: 0.94,
      },
      {
        id: rec2,
        recordCode: 'REC-1042',
        assetId: assetP104,
        assetCode: 'P-104',
        assetName: 'Water Pump',
        locationName: 'Block A — Academic & Hydraulics Wing',
        incidentDate: '2026-03-08',
        category: 'Water Supply',
        recordType: 'Repair',
        title: 'Unusual grinding noise and bearing replacement',
        description: 'Audible grinding noise detected from pump drive end 55 days after prior adjustment. Drive bearing (P-104-B) showed spalling wear.',
        symptoms: ['Unusual noise', 'Bearing wear'],
        repairAction: 'Bearing replacement completed with new SKF unit; test run successful and noise eliminated.',
        componentInvolved: 'Drive Bearing (P-104-B)',
        technicianName: 'J. Carter',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: docLogP104,
        sourceDocumentName: 'BlockA_Pump_P104_Handwritten_Register.jpg',
        confidence: 0.96,
      },
      {
        id: rec3,
        recordCode: 'REC-1043',
        assetId: assetP104,
        assetCode: 'P-104',
        assetName: 'Water Pump',
        locationName: 'Block A — Academic & Hydraulics Wing',
        incidentDate: '2026-04-26',
        category: 'Water Supply',
        recordType: 'Incident',
        title: 'Vibration reported again under peak load',
        description: 'Vibration returned 49 days after bearing replacement. Preliminary check noted minor shaft misalignment during peak campus demand.',
        symptoms: ['Excessive vibration', 'Shaft misalignment'],
        repairAction: 'Maintenance inspection logged; temporary coupling realignment performed pending full assembly audit.',
        componentInvolved: 'Drive Bearing (P-104-B)',
        technicianName: 'D. Adams',
        status: 'Monitoring',
        inspectionStatus: 'Scheduled',
        sourceDocumentId: docLogP104,
        sourceDocumentName: 'BlockA_Pump_P104_Handwritten_Register.jpg',
        confidence: 0.95,
      },
      {
        id: rec4,
        recordCode: 'REC-2011',
        assetId: assetG201,
        assetCode: 'G-201',
        assetName: 'Backup Generator',
        locationName: 'Main Building — Administration & Core Power',
        incidentDate: '2026-02-04',
        category: 'Electrical',
        recordType: 'Preventive',
        title: 'Quarterly load bank & AVR calibration test',
        description: 'Scheduled 80% load bank test executed on G-201. Transient voltage dip observed briefly on step load transfer.',
        symptoms: ['Voltage fluctuation'],
        repairAction: 'AVR gain potentiometer tuned; output stabilized at 415V.',
        componentInvolved: 'Automatic Voltage Regulator (AVR)',
        technicianName: 'R. Patel',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: docGenService,
        sourceDocumentName: 'G201_LoadBank_Inspection_Q1.pdf',
        confidence: 0.98,
      },
      {
        id: rec5,
        recordCode: 'REC-2012',
        assetId: assetG201,
        assetCode: 'G-201',
        assetName: 'Backup Generator',
        locationName: 'Main Building — Administration & Core Power',
        incidentDate: '2026-04-14',
        category: 'Electrical',
        recordType: 'Inspection',
        title: 'Starter battery float charge verification',
        description: 'Monthly cranking battery inspection confirmed healthy cell gravity and terminal torque.',
        symptoms: [],
        repairAction: 'Cleaned positive terminal post and applied anti-corrosion dielectric grease.',
        componentInvolved: 'Starter Battery Bank',
        technicianName: 'R. Patel',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: docGenService,
        sourceDocumentName: 'G201_LoadBank_Inspection_Q1.pdf',
        confidence: 0.97,
      },
      {
        id: rec6,
        recordCode: 'REC-3021',
        assetId: assetAC302,
        assetCode: 'AC-302',
        assetName: 'Air Conditioning Unit',
        locationName: 'Computer Lab — Engineering Annex',
        incidentDate: '2026-02-19',
        category: 'Cooling Systems',
        recordType: 'Incident',
        title: 'High head pressure trip during afternoon lab session',
        description: 'AC-302 condenser circuit B tripped on high pressure fault when outdoor ambient temperature reached 34°C.',
        symptoms: ['High pressure fault', 'Overheating'],
        repairAction: 'Cleaned condenser aluminum fins and cleared debris from rooftop intake screen.',
        componentInvolved: 'Condenser Fan Motor',
        technicianName: 'S. Nair',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: docAcInspect,
        sourceDocumentName: 'AC302_Compressor_Thermal_Note.txt',
        confidence: 0.92,
      },
      {
        id: rec7,
        recordCode: 'REC-3022',
        assetId: assetAC302,
        assetCode: 'AC-302',
        assetName: 'Air Conditioning Unit',
        locationName: 'Computer Lab — Engineering Annex',
        incidentDate: '2026-05-03',
        category: 'Cooling Systems',
        recordType: 'Incident',
        title: 'Recurring compressor thermal cut-out and warm supply air',
        description: 'Computer Lab indoor temperature rose to 26.5°C. Scroll Compressor B thermal overload tripped twice within 4 hours.',
        symptoms: ['Overheating', 'High pressure fault'],
        repairAction: 'Unit placed under active maintenance; refrigerant charge and condenser fan amperage queued for diagnostic test.',
        componentInvolved: 'Scroll Compressor B',
        technicianName: 'S. Nair',
        status: 'In Progress',
        inspectionStatus: 'Pending',
        sourceDocumentId: docAcInspect,
        sourceDocumentName: 'AC302_Compressor_Thermal_Note.txt',
        confidence: 0.91,
      },
      {
        id: rec8,
        recordCode: 'REC-4011',
        assetId: assetE401,
        assetCode: 'E-401',
        assetName: 'Elevator',
        locationName: 'Block B — Lecture & Vertical Transit Wing',
        incidentDate: '2026-03-22',
        category: 'Mechanical',
        recordType: 'Repair',
        title: 'Level 2 landing door hesitation during close cycle',
        description: 'Car door hesitated briefly at 30% closure on 2nd floor landing due to dust buildup in sill track.',
        symptoms: ['Door hesitation'],
        repairAction: 'Vacuumed landing sill track and adjusted door operator belt tension.',
        componentInvolved: 'Door Operator Motor',
        technicianName: 'K. Morales',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: '',
        sourceDocumentName: '',
        confidence: 0.9,
      },
      {
        id: rec9,
        recordCode: 'REC-5011',
        assetId: assetEP501,
        assetCode: 'EP-501',
        assetName: 'Electrical Panel',
        locationName: 'Main Building — Administration & Core Power',
        incidentDate: '2026-04-02',
        category: 'Electrical',
        recordType: 'Inspection',
        title: 'Infrared thermography scan on 800A busbar',
        description: 'Routine IR thermography showed uniform phase temperatures (39°C–41°C) across L1/L2/L3 terminations.',
        symptoms: [],
        repairAction: 'No corrective intervention required; baseline IR image archived.',
        componentInvolved: 'Copper Busbar Assembly',
        technicianName: 'R. Patel',
        status: 'Resolved',
        inspectionStatus: 'Completed',
        sourceDocumentId: '',
        sourceDocumentName: '',
        confidence: 0.99,
      },
    ];

    for (const r of records) {
      batch3.set(doc(db, 'maintenanceRecords', r.id), {
        recordCode: r.recordCode,
        assetId: r.assetId,
        assetCode: r.assetCode,
        assetName: r.assetName,
        locationName: r.locationName,
        incidentDate: r.incidentDate,
        category: r.category,
        recordType: r.recordType,
        title: r.title,
        description: r.description,
        symptoms: r.symptoms,
        repairAction: r.repairAction,
        componentInvolved: r.componentInvolved,
        technicianName: r.technicianName,
        status: r.status,
        inspectionStatus: r.inspectionStatus,
        sourceDocumentId: r.sourceDocumentId,
        sourceDocumentName: r.sourceDocumentName,
        confidence: r.confidence,
        isDemoData: true,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch3.set(doc(db, 'recommendations', recFindingP104), {
      title: 'Repeated vibration reports detected for Water Pump P-104',
      assetId: assetP104,
      assetCode: 'P-104',
      assetName: 'Water Pump',
      ruleTriggered: 'R-02 · Repeated Similar Symptom Cluster & R-04 · Shortening Intervals',
      ruleDescription: '3 vibration/noise incidents within 104 days (Jan 12 -> Mar 08 [55d] -> Apr 26 [49d]), including repeated Drive Bearing (P-104-B) interventions.',
      severity: 'High',
      observedFacts: [
        '2026-01-12 (REC-1041): Excessive vibration reported — Bearing adjustment performed.',
        '2026-03-08 (REC-1042): Unusual grinding noise reported — Drive Bearing (P-104-B) replaced with SKF unit.',
        '2026-04-26 (REC-1043): Vibration reported again under peak load — Minor shaft misalignment noted during inspection.',
      ],
      interpretation:
        'Multiple maintenance records indicate recurring vibration-related symptoms on Water Pump P-104, with the interval between events narrowing from 55 days to 49 days even after bearing replacement. Evidence suggests a recurring mechanical or alignment-related pattern rather than confirming a single defective part.',
      missingInformation: [
        'Laser shaft alignment tolerance measurements before and after the March 8 bearing replacement.',
        'Quantitative RMS vibration velocity readings (mm/s) across bearing housings.',
        'Baseplate anchor bolt torque verification and suction piping strain check.',
      ],
      suggestedActions: [
        'Inspect the complete P-104 pump assembly, coupling, and concrete plinth mounting.',
        'Review the March 8 Drive Bearing (P-104-B) replacement record and verify shaft runout.',
        'Record baseline RMS vibration readings after corrective alignment.',
      ],
      supportingRecordIds: [rec1, rec2, rec3],
      contradictoryRecordIds: [rec1, rec2],
      evidenceCompleteness: 92,
      status: 'Active',
      isDemoData: true,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch3.set(doc(db, 'recommendations', recFindingAC302), {
      title: 'Recurring high-pressure thermal trips on Computer Lab AC-302',
      assetId: assetAC302,
      assetCode: 'AC-302',
      assetName: 'Air Conditioning Unit',
      ruleTriggered: 'R-02 · Repeated Similar Symptom Cluster',
      ruleDescription: '2 overheating / high-pressure trip incidents logged within 73 days (Feb 19 and May 03).',
      severity: 'Medium',
      observedFacts: [
        '2026-02-19 (REC-3021): High head pressure trip during afternoon lab session — Condenser fins cleaned.',
        '2026-05-03 (REC-3022): Recurring compressor thermal cut-out and warm supply air — Under maintenance.',
      ],
      interpretation:
        'Two cooling-system thermal cut-out events occurred during peak afternoon loads. While condenser cleaning temporarily restored operation in February, the May recurrence indicates airflow, condenser fan performance, or refrigerant subcooling should be checked.',
      missingInformation: [
        'Condenser fan motor current draw readings under peak ambient conditions.',
        'Refrigerant superheat and subcooling gauge pressures.',
      ],
      suggestedActions: [
        'Measure condenser fan motor amperage and verify blade pitch/airflow.',
        'Check refrigerant pressure profile and thermal expansion valve response.',
      ],
      supportingRecordIds: [rec6, rec7],
      contradictoryRecordIds: [rec6],
      evidenceCompleteness: 88,
      status: 'Active',
      isDemoData: true,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch3.set(doc(db, 'notifications', makeId(uid, 'notif_p104')), {
      title: 'Recurring Pattern Detected: Water Pump P-104',
      message: '3 vibration/noise incidents connected across Jan 12, Mar 08, and Apr 26 (shortening interval: 55d -> 49d). Inspection recommended.',
      severity: 'High',
      assetId: assetP104,
      recommendationId: recFindingP104,
      read: false,
      isDemoData: true,
      ownerUid: uid,
      createdAt: serverTimestamp(),
    });

    batch3.set(doc(db, 'notifications', makeId(uid, 'notif_ac302')), {
      title: 'Repeated Thermal Trips: AC-302',
      message: 'Computer Lab AC-302 logged 2 high-pressure thermal trips in 73 days. Review historical condenser logs.',
      severity: 'Medium',
      assetId: assetAC302,
      recommendationId: recFindingAC302,
      read: false,
      isDemoData: true,
      ownerUid: uid,
      createdAt: serverTimestamp(),
    });

    const defaultRules = [
      {
        id: makeId(uid, 'rule_R01'),
        code: 'R-01',
        name: 'High-Frequency Asset Incidents',
        description: 'Flags an asset when N or more maintenance incidents occur within the configured day window.',
        thresholdCount: 3,
        windowDays: 120,
        enabled: true,
      },
      {
        id: makeId(uid, 'rule_R02'),
        code: 'R-02',
        name: 'Repeated Similar Symptom Cluster',
        description: 'Detects recurring normalized symptoms (e.g., vibration, noise, overheating) on the same asset.',
        thresholdCount: 2,
        windowDays: 180,
        enabled: true,
      },
      {
        id: makeId(uid, 'rule_R03'),
        code: 'R-03',
        name: 'Repeated Component Intervention',
        description: 'Flags repeated adjustments, inspections, or replacements targeting the same sub-component.',
        thresholdCount: 2,
        windowDays: 180,
        enabled: true,
      },
      {
        id: makeId(uid, 'rule_R04'),
        code: 'R-04',
        name: 'Shortening Incident Intervals',
        description: 'Detects decreasing day intervals between consecutive incidents on the same asset.',
        thresholdCount: 3,
        windowDays: 240,
        enabled: true,
      },
      {
        id: makeId(uid, 'rule_R05'),
        code: 'R-05',
        name: 'Location & Category Hotspot',
        description: 'Identifies shared campus buildings experiencing multiple cross-asset maintenance events.',
        thresholdCount: 3,
        windowDays: 180,
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      batch3.set(doc(db, 'ruleConfigs', rule.id), {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        thresholdCount: rule.thresholdCount,
        windowDays: rule.windowDays,
        enabled: rule.enabled,
        ownerUid: uid,
        updatedAt: serverTimestamp(),
      });
    }

    await batch3.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'demoSeed');
  }
}
