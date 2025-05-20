const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { auth, managerAndAbove } = require('../middleware/auth');

// @route    GET api/shipments
// @desc     Get all shipments
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    console.log(`[GET /api/shipments] 요청 시작: ${new Date().toISOString()}`);
    
    // 1. 먼저 기존 shipments 테이블 데이터 가져오기
    let query = '';
    let queryParams = [];
    
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      // Admins and managers can see all shipments
      query = `
        SELECT s.*, u.username as driver_name, c.username as creator_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        JOIN users c ON s.created_by = c.id
        ORDER BY s.created_at DESC
      `;
    } else if (req.user.role === 'driver') {
      // Drivers can see only their assigned shipments
      query = `
        SELECT s.*, u.username as driver_name, c.username as creator_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        JOIN users c ON s.created_by = c.id
        WHERE s.assigned_driver = ?
        ORDER BY s.created_at DESC
      `;
      queryParams.push(req.user.id);
    } else {
      // Clerks can see all shipments but with limited fields
      query = `
        SELECT s.id, s.shipment_number, s.origin, s.destination, s.status, 
               s.created_at, u.username as driver_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        ORDER BY s.created_at DESC
      `;
    }
    
    console.log('[GET /api/shipments] shipments 테이블 쿼리 실행');
    const [shipmentsRows] = await pool.query(query, queryParams);
    console.log(`[DEBUG] shipments 테이블 데이터 개수: ${shipmentsRows.length}개`);
    
    // 2. 그 다음 shipments_data 테이블 데이터 가져오기
    console.log('[GET /api/shipments] shipments_data 테이블 쿼리 실행');
    const [shipmentsDataRows] = await pool.query(
      `SELECT 
        id, 일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
        source_sheet, all_data, created_by, created_at, 
        isInvoiceLocked, invoiceMemo, invoicePassword
       FROM shipments_data
       ORDER BY created_at DESC`
    );
    console.log(`[DEBUG] shipments_data 테이블 데이터 개수: ${shipmentsDataRows.length}개`);
    
    if (shipmentsDataRows.length > 0) {
      console.log('[GET /api/shipments] 첫 번째 데이터 샘플:', {
        id: shipmentsDataRows[0].id,
        일시: shipmentsDataRows[0].일시,
        all_data_type: typeof shipmentsDataRows[0].all_data
      });
    }
    
    // 3. shipments_data 테이블 데이터를 shipments 형식으로 변환
    console.log('[GET /api/shipments] 데이터 변환 시작');
    const formattedDataRows = shipmentsDataRows.map(row => {
      // JSON 문자열을 객체로 변환
      let allData = {};
      try {
        if (row.all_data) {
          if (typeof row.all_data === 'string') {
            allData = JSON.parse(row.all_data);
          } else if (typeof row.all_data === 'object') {
            // MySQL의 JSON 타입으로 자동 변환된 경우
            allData = row.all_data;
          }
        }
      } catch (e) {
        console.error(`JSON 파싱 오류 (ID: ${row.id}):`, e);
        // JSON 파싱 오류 시 빈 객체로 처리
        allData = {};
      }
      
      // 기본 필드 매핑
      const formattedRow = {
        id: `data_${row.id}`, // 일반 shipments와 구분하기 위한 접두사
        shipment_number: row.id.toString(),
        origin: row.상차지 || '',
        destination: row.하차지 || '',
        cargo_type: '시트 데이터',
        weight: 0,
        status: 'delivered',
        assigned_driver: null,
        driver_name: row.기사명 || '',
        creator_name: '시트 가져오기',
        created_by: row.created_by,
        created_at: row.created_at,
        
        // 계산서 관련 필드 추가
        isInvoiceLocked: row.isInvoiceLocked ? true : false,
        invoiceMemo: row.invoiceMemo || '',
        invoicePassword: row.invoicePassword || '',
        
        // 시트 특별 필드
        isSheetData: true,
        sheetName: row.source_sheet || '',
        
        // 기본 시트 데이터 필드
        일시: row.일시 || '',
        원청: row.원청 || '',
        소속: row.소속 || '',
        차량번호: row.차량번호 || '',
        기사명: row.기사명 || '',
        연락처: row.연락처 || '',
        상차지: row.상차지 || '',
        하차지: row.하차지 || '',
        금액: row.금액 || ''
      };
      
      // all_data에 있는 모든 추가 필드를 개별 필드로 추가
      if (allData && typeof allData === 'object') {
        Object.keys(allData).forEach(key => {
          // 이미 기본 필드에 추가된 키는 제외 (중복 방지)
          if (!formattedRow.hasOwnProperty(key)) {
            formattedRow[key] = allData[key];
          }
        });
      }
      
      return formattedRow;
    });
    console.log('[GET /api/shipments] 데이터 변환 완료');
    
    // 4. 두 결과 합치기
    const combinedData = [...shipmentsRows, ...formattedDataRows];
    console.log(`[DEBUG] 최종 반환 데이터 개수: ${combinedData.length}개`);
    
    // 5. 최종 결과 정렬 (최신 순)
    combinedData.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
    
    console.log(`[GET /api/shipments] 응답 전송: ${combinedData.length}개 데이터`);
    return res.json(combinedData);
  } catch (err) {
    console.error('화물 데이터 조회 오류:', err);
    return res.status(500).send('서버 오류');
  }
});

// @route    GET api/shipments/:id
// @desc     Get shipment by ID
// @access   Private
router.get('/:id', auth, async (req, res) => {
  try {
    const shipmentId = req.params.id;
    
    // Check if this is a sheet data ID (starts with "data_")
    if (shipmentId.startsWith('data_')) {
      // Extract the numeric ID from "data_123" format
      const dataId = shipmentId.replace('data_', '');
      
      // Fetch from shipments_data table
      const [dataRows] = await pool.query(
        `SELECT * FROM shipments_data WHERE id = ?`,
        [dataId]
      );
      
      if (dataRows.length === 0) {
        return res.status(404).json({ message: '시트 데이터를 찾을 수 없습니다' });
      }
      
      const row = dataRows[0];
      
      // JSON 문자열을 객체로 변환
      let allData = {};
      try {
        if (row.all_data) {
          allData = typeof row.all_data === 'string' 
            ? JSON.parse(row.all_data) 
            : row.all_data;
        }
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
      }
      
      // 기본 필드 매핑
      const formattedRow = {
        id: `data_${row.id}`,
        shipment_number: row.id.toString(),
        origin: row.상차지 || '',
        destination: row.하차지 || '',
        cargo_type: '시트 데이터',
        weight: 0,
        status: 'delivered',
        assigned_driver: null,
        driver_name: row.기사명 || '',
        creator_name: '시트 가져오기',
        created_by: row.created_by,
        created_at: row.created_at,
        
        // 계산서 관련 필드 추가
        isInvoiceLocked: row.isInvoiceLocked,
        invoiceMemo: row.invoiceMemo,
        invoicePassword: row.invoicePassword,
        
        // 시트 특별 필드
        isSheetData: true,
        sheetName: row.source_sheet,
        
        // 기본 시트 데이터 필드
        일시: row.일시 || '',
        원청: row.원청 || '',
        소속: row.소속 || '',
        차량번호: row.차량번호 || '',
        기사명: row.기사명 || '',
        연락처: row.연락처 || '',
        상차지: row.상차지 || '',
        하차지: row.하차지 || '',
        금액: row.금액 || ''
      };
      
      // all_data에 있는 모든 추가 필드를 개별 필드로 추가
      if (allData && typeof allData === 'object') {
        Object.keys(allData).forEach(key => {
          // 기본 필드와 중복되지 않는 경우에만 추가
          if (!formattedRow.hasOwnProperty(key)) {
            formattedRow[key] = allData[key];
          }
        });
      }
      
      return res.json(formattedRow);
    }
    
    // Original shipment data handling (unchanged)
    let query = '';
    let queryParams = [shipmentId];
    
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      // Admins and managers can see all shipment details
      query = `
        SELECT s.*, u.username as driver_name, c.username as creator_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        JOIN users c ON s.created_by = c.id
        WHERE s.id = ?
      `;
    } else if (req.user.role === 'driver') {
      // Drivers can see only their assigned shipments
      query = `
        SELECT s.*, u.username as driver_name, c.username as creator_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        JOIN users c ON s.created_by = c.id
        WHERE s.id = ? AND s.assigned_driver = ?
      `;
      queryParams.push(req.user.id);
    } else {
      // Clerks can see limited fields
      query = `
        SELECT s.id, s.shipment_number, s.origin, s.destination, s.status, 
               s.created_at, u.username as driver_name
        FROM shipments s
        LEFT JOIN users u ON s.assigned_driver = u.id
        WHERE s.id = ?
      `;
    }
    
    const [rows] = await pool.query(query, queryParams);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: '화물 정보를 찾을 수 없습니다' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('서버 오류');
  }
});

// @route    POST api/shipments
// @desc     Create a shipment
// @access   Private (Managers and Admins)
router.post(
  '/',
  [
    auth,
    managerAndAbove,
    [
      check('shipment_number', '화물 번호는 필수입니다').not().isEmpty(),
      check('origin', '출발지는 필수입니다').not().isEmpty(),
      check('destination', '도착지는 필수입니다').not().isEmpty(),
      check('cargo_type', '화물 유형은 필수입니다').not().isEmpty(),
      check('weight', '무게는 필수입니다').isNumeric(),
      check('status', '상태는 유효해야 합니다').isIn(['pending', 'in_transit', 'delivered', 'cancelled'])
    ]
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      shipment_number, 
      origin, 
      destination, 
      cargo_type, 
      weight, 
      status, 
      assigned_driver 
    } = req.body;

    try {
      // Check if shipment number already exists
      const [existingShipments] = await pool.query(
        'SELECT * FROM shipments WHERE shipment_number = ?',
        [shipment_number]
      );

      if (existingShipments.length > 0) {
        return res.status(400).json({ message: '이미 존재하는 화물 번호입니다' });
      }

      // If assigned_driver is provided, check if the driver exists
      if (assigned_driver) {
        const [driverRows] = await pool.query(
          'SELECT * FROM users WHERE id = ? AND role = "driver"',
          [assigned_driver]
        );
        
        if (driverRows.length === 0) {
          return res.status(400).json({ message: '유효하지 않은 운전자입니다' });
        }
      }

      // Insert shipment
      const [result] = await pool.query(
        `INSERT INTO shipments 
          (shipment_number, origin, destination, cargo_type, weight, status, assigned_driver, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shipment_number, 
          origin, 
          destination, 
          cargo_type, 
          weight, 
          status, 
          assigned_driver || null, 
          req.user.id
        ]
      );

      if (result.affectedRows > 0) {
        // Get the created shipment
        const [newShipment] = await pool.query(
          `SELECT s.*, u.username as driver_name, c.username as creator_name
           FROM shipments s
           LEFT JOIN users u ON s.assigned_driver = u.id
           JOIN users c ON s.created_by = c.id
           WHERE s.id = ?`,
          [result.insertId]
        );

        res.status(201).json(newShipment[0]);
      } else {
        res.status(500).json({ message: '화물 정보 생성 실패' });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    PUT api/shipments/:id
// @desc     Update a shipment
// @access   Private (Managers and Admins)
router.put(
  '/:id',
  [
    auth,
    managerAndAbove,
    [
      check('shipment_number', '화물 번호는 필수입니다').optional().not().isEmpty(),
      check('origin', '출발지는 필수입니다').optional().not().isEmpty(),
      check('destination', '도착지는 필수입니다').optional().not().isEmpty(),
      check('cargo_type', '화물 유형은 필수입니다').optional().not().isEmpty(),
      check('weight', '무게는 필수입니다').optional().isNumeric(),
      check('status', '상태는 유효해야 합니다').optional().isIn(['pending', 'in_transit', 'delivered', 'cancelled'])
    ]
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      shipment_number, 
      origin, 
      destination, 
      cargo_type, 
      weight, 
      status, 
      assigned_driver 
    } = req.body;
    
    const shipmentId = req.params.id;

    try {
      // Check if shipment exists
      const [shipmentRows] = await pool.query(
        'SELECT * FROM shipments WHERE id = ?',
        [shipmentId]
      );
      
      if (shipmentRows.length === 0) {
        return res.status(404).json({ message: '화물 정보를 찾을 수 없습니다' });
      }

      // If assigned_driver is provided, check if the driver exists
      if (assigned_driver) {
        const [driverRows] = await pool.query(
          'SELECT * FROM users WHERE id = ? AND role = "driver"',
          [assigned_driver]
        );
        
        if (driverRows.length === 0) {
          return res.status(400).json({ message: '유효하지 않은 운전자입니다' });
        }
      }

      // Build update fields
      let updateQuery = 'UPDATE shipments SET ';
      const updateValues = [];
      
      if (shipment_number) {
        updateQuery += 'shipment_number = ?, ';
        updateValues.push(shipment_number);
      }
      
      if (origin) {
        updateQuery += 'origin = ?, ';
        updateValues.push(origin);
      }
      
      if (destination) {
        updateQuery += 'destination = ?, ';
        updateValues.push(destination);
      }
      
      if (cargo_type) {
        updateQuery += 'cargo_type = ?, ';
        updateValues.push(cargo_type);
      }
      
      if (weight) {
        updateQuery += 'weight = ?, ';
        updateValues.push(weight);
      }
      
      if (status) {
        updateQuery += 'status = ?, ';
        updateValues.push(status);
      }
      
      if (assigned_driver !== undefined) {
        updateQuery += 'assigned_driver = ?, ';
        updateValues.push(assigned_driver === null ? null : assigned_driver);
      }
      
      // Remove trailing comma and space
      updateQuery = updateQuery.slice(0, -2);
      
      // Add WHERE condition
      updateQuery += ' WHERE id = ?';
      updateValues.push(shipmentId);
      
      // Execute update
      const [result] = await pool.query(updateQuery, updateValues);
      
      if (result.affectedRows > 0) {
        // Get the updated shipment
        const [updatedShipment] = await pool.query(
          `SELECT s.*, u.username as driver_name, c.username as creator_name
           FROM shipments s
           LEFT JOIN users u ON s.assigned_driver = u.id
           JOIN users c ON s.created_by = c.id
           WHERE s.id = ?`,
          [shipmentId]
        );
        
        res.json(updatedShipment[0]);
      } else {
        res.status(500).json({ message: '화물 정보 업데이트 실패' });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    DELETE api/shipments/:id
// @desc     Delete a shipment
// @access   Private (Managers and Admins)
router.delete('/:id', [auth, managerAndAbove], async (req, res) => {
  try {
    const shipmentId = req.params.id;
    
    // Check if shipment exists
    const [shipmentRows] = await pool.query(
      'SELECT * FROM shipments WHERE id = ?',
      [shipmentId]
    );
    
    if (shipmentRows.length === 0) {
      return res.status(404).json({ message: '화물 정보를 찾을 수 없습니다' });
    }
    
    // Don't allow deleting delivered shipments for record keeping
    if (shipmentRows[0].status === 'delivered') {
      return res.status(400).json({ message: '배송 완료된 화물은 삭제할 수 없습니다' });
    }
    
    // Execute delete
    const [result] = await pool.query('DELETE FROM shipments WHERE id = ?', [shipmentId]);
    
    if (result.affectedRows > 0) {
      res.json({ message: '화물 정보가 삭제되었습니다' });
    } else {
      res.status(500).json({ message: '화물 정보 삭제 실패' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('서버 오류');
  }
});

// @route    PUT api/shipments/:id/status
// @desc     Update shipment status
// @access   Private (Drivers can only update their own assigned shipments)
router.put(
  '/:id/status',
  [
    auth,
    check('status', '상태는 유효해야 합니다').isIn(['pending', 'in_transit', 'delivered', 'cancelled'])
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const shipmentId = req.params.id;

    try {
      // Check if shipment exists
      const [shipmentRows] = await pool.query(
        'SELECT * FROM shipments WHERE id = ?',
        [shipmentId]
      );
      
      if (shipmentRows.length === 0) {
        return res.status(404).json({ message: '화물 정보를 찾을 수 없습니다' });
      }
      
      const shipment = shipmentRows[0];
      
      // If user is a driver, they can only update their assigned shipments
      if (req.user.role === 'driver' && shipment.assigned_driver !== req.user.id) {
        return res.status(403).json({ message: '본인에게 할당된 화물만 업데이트할 수 있습니다' });
      }
      
      // Update status
      const [result] = await pool.query(
        'UPDATE shipments SET status = ? WHERE id = ?',
        [status, shipmentId]
      );
      
      if (result.affectedRows > 0) {
        // Get the updated shipment
        const [updatedShipment] = await pool.query(
          `SELECT s.*, u.username as driver_name, c.username as creator_name
           FROM shipments s
           LEFT JOIN users u ON s.assigned_driver = u.id
           JOIN users c ON s.created_by = c.id
           WHERE s.id = ?`,
          [shipmentId]
        );
        
        res.json(updatedShipment[0]);
      } else {
        res.status(500).json({ message: '화물 상태 업데이트 실패' });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    POST api/shipments/bulk-update
// @desc     Update multiple shipments with the same field value
// @access   Private (Managers and Admins)
router.post(
  '/bulk-update',
  [
    auth,
    managerAndAbove,
    [
      check('ids', '선택된 항목 ID 목록이 필요합니다').isArray(),
      check('field', '수정할 필드명이 필요합니다').not().isEmpty(),
      check('value', '변경할 값이 필요합니다').exists()
    ]
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ids, field, value } = req.body;

    // 빈 배열 체크
    if (ids.length === 0) {
      return res.status(400).json({ message: '업데이트할 항목이 선택되지 않았습니다' });
    }

    try {
      // 허용된 필드인지 확인
      const allowedFields = [
        'shipment_number', 'origin', 'destination', 'cargo_type', 'weight', 
        'status', 'assigned_driver', '차량번호', '기사명', '상차자', '하차자', '원청'
      ];
      
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ message: '허용되지 않은 필드입니다' });
      }
      
      // 상태 필드인 경우 유효한 값인지 확인
      if (field === 'status' && !['pending', 'in_transit', 'delivered', 'cancelled'].includes(value)) {
        return res.status(400).json({ message: '유효하지 않은 상태 값입니다' });
      }
      
      // SQL Injection 방지를 위해 필드명은 직접 파라미터화할 수 없으므로 이 방식 사용
      const updateQuery = `UPDATE shipments SET \`${field}\` = ? WHERE id IN (?)`;
      
      // 업데이트 실행
      const [result] = await pool.query(updateQuery, [value, ids]);
      
      if (result.affectedRows > 0) {
        res.json({ 
          message: `${result.affectedRows}개 항목이 성공적으로 업데이트되었습니다`,
          updatedCount: result.affectedRows
        });
      } else {
        res.status(400).json({ message: '업데이트된 항목이 없습니다' });
      }
    } catch (err) {
      console.error('일괄 업데이트 오류:', err.message);
      res.status(500).send('서버 오류');
    }
  }
);

// @route    POST api/shipments/save-all
// @desc     Save all shipment data
// @access   Private (Managers and Admins)
router.post('/save-all', [auth, managerAndAbove], async (req, res) => {
  try {
    console.log('[POST /api/shipments/save-all] 일괄 저장 요청 받음');
    const startTime = Date.now();
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ message: '유효하지 않은 데이터 형식입니다.' });
    }

    console.log(`[POST /api/shipments/save-all] 총 ${data.length}개의 항목 처리 시작`);

    // 트랜잭션 시작
    await pool.query('START TRANSACTION');

    try {
      // 1. 모든 기존 데이터의 ID 목록 가져오기
      const [existingData] = await pool.query(`SELECT id FROM shipments_data`);
      
      // 기존 데이터 ID 목록
      const existingIds = existingData.map(item => item.id.toString());
      
      // 현재 전송된 데이터 ID 목록 (data_ 접두사 제거)
      const currentIds = data
        .filter(item => item.id && typeof item.id === 'string' && item.id.startsWith('data_'))
        .map(item => item.id.replace('data_', ''));
      
      // 2. 삭제할 ID 목록 찾기 (기존 ID 중에서 현재 목록에 없는 것)
      const idsToDelete = existingIds.filter(id => !currentIds.includes(id));
      
      // 3. 삭제할 항목이 있으면 삭제 실행
      if (idsToDelete.length > 0) {
        console.log(`[POST /api/shipments/save-all] ${idsToDelete.length}개 항목 삭제 중...`);
        
        // 대량 삭제 최적화: 청크 단위로 삭제 (MySQL에서 IN 절에 값이 너무 많으면 성능 저하 발생)
        const DELETE_CHUNK_SIZE = 1000;
        for (let i = 0; i < idsToDelete.length; i += DELETE_CHUNK_SIZE) {
          const deleteChunk = idsToDelete.slice(i, i + DELETE_CHUNK_SIZE);
          await pool.query(
            `DELETE FROM shipments_data WHERE id IN (?)`,
            [deleteChunk]
          );
          console.log(`[POST /api/shipments/save-all] 삭제 진행 중: ${Math.min(i + DELETE_CHUNK_SIZE, idsToDelete.length)}/${idsToDelete.length}`);
        }
        
        console.log(`[POST /api/shipments/save-all] ${idsToDelete.length}개 항목 삭제 완료`);
      }
      
      // 4. 데이터 분류: 업데이트할 항목과 새로 삽입할 항목 분리
      const updateItems = data.filter(item => item.id && typeof item.id === 'string' && item.id.startsWith('data_'));
      const insertItems = data.filter(item => !(item.id && typeof item.id === 'string' && item.id.startsWith('data_')));
      
      console.log(`[POST /api/shipments/save-all] 업데이트 항목: ${updateItems.length}개, 삽입 항목: ${insertItems.length}개`);
      
      // 5. 업데이트 항목 처리 (배치 처리)
      if (updateItems.length > 0) {
        console.log(`[POST /api/shipments/save-all] 업데이트 항목 처리 시작`);
        
        const UPDATE_BATCH_SIZE = 500;
        const updateBatches = [];
        
        for (let i = 0; i < updateItems.length; i += UPDATE_BATCH_SIZE) {
          updateBatches.push(updateItems.slice(i, i + UPDATE_BATCH_SIZE));
        }
        
        let updatedCount = 0;
        
        // 배치 병렬 처리를 위한 최대 동시 실행 배치 수
        const MAX_PARALLEL_BATCHES = 5;
        const updatePromises = [];
        
        // 각 배치 처리
        for (const batch of updateBatches) {
          // 병렬 처리 제한
          if (updatePromises.length >= MAX_PARALLEL_BATCHES) {
            await Promise.race(updatePromises);
            // 완료된 프로미스 제거
            for (let i = updatePromises.length - 1; i >= 0; i--) {
              if (updatePromises[i].isCompleted) {
                updatePromises.splice(i, 1);
              }
            }
          }
          
          // 배치 처리 프로미스 생성
          const batchPromise = processBatch(batch, true);
          batchPromise.then(() => {
            updatedCount += batch.length;
            batchPromise.isCompleted = true;
            const progress = Math.round((updatedCount / updateItems.length) * 100);
            console.log(`[POST /api/shipments/save-all] 업데이트 진행: ${updatedCount}/${updateItems.length} (${progress}%)`);
          });
          
          updatePromises.push(batchPromise);
        }
        
        // 모든 업데이트 완료 대기
        await Promise.all(updatePromises);
        console.log(`[POST /api/shipments/save-all] 모든 업데이트 완료: ${updatedCount}개 항목`);
      }
      
      // 6. 삽입 항목 처리 (배치 처리)
      if (insertItems.length > 0) {
        console.log(`[POST /api/shipments/save-all] 삽입 항목 처리 시작`);
        
        const INSERT_BATCH_SIZE = 500;
        const insertBatches = [];
        
        for (let i = 0; i < insertItems.length; i += INSERT_BATCH_SIZE) {
          insertBatches.push(insertItems.slice(i, i + INSERT_BATCH_SIZE));
        }
        
        let insertedCount = 0;
        
        // 배치 병렬 처리를 위한 최대 동시 실행 배치 수
        const MAX_PARALLEL_BATCHES = 5;
        const insertPromises = [];
        
        // 각 배치 처리
        for (const batch of insertBatches) {
          // 병렬 처리 제한
          if (insertPromises.length >= MAX_PARALLEL_BATCHES) {
            await Promise.race(insertPromises);
            // 완료된 프로미스 제거
            for (let i = insertPromises.length - 1; i >= 0; i--) {
              if (insertPromises[i].isCompleted) {
                insertPromises.splice(i, 1);
              }
            }
          }
          
          // 배치 처리 프로미스 생성
          const batchPromise = processBatch(batch, false);
          batchPromise.then(() => {
            insertedCount += batch.length;
            batchPromise.isCompleted = true;
            const progress = Math.round((insertedCount / insertItems.length) * 100);
            console.log(`[POST /api/shipments/save-all] 삽입 진행: ${insertedCount}/${insertItems.length} (${progress}%)`);
          });
          
          insertPromises.push(batchPromise);
        }
        
        // 모든 삽입 완료 대기
        await Promise.all(insertPromises);
        console.log(`[POST /api/shipments/save-all] 모든 삽입 완료: ${insertedCount}개 항목`);
      }
      
      // 트랜잭션 커밋
      await pool.query('COMMIT');
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`[POST /api/shipments/save-all] 총 처리 시간: ${totalTime.toFixed(2)}초`);
      
      res.json({ 
        success: true, 
        message: '모든 데이터가 성공적으로 저장되었습니다.',
        deleted: idsToDelete.length,
        updated: updateItems.length,
        inserted: insertItems.length,
        processingTime: `${totalTime.toFixed(2)}초`
      });
    } catch (error) {
      // 오류 발생 시 롤백
      await pool.query('ROLLBACK');
      console.error('[POST /api/shipments/save-all] 오류 발생, 트랜잭션 롤백:', error);
      throw error;
    }
  } catch (err) {
    console.error('[POST /api/shipments/save-all] 데이터 저장 오류:', err);
    res.status(500).send('서버 오류');
  }
  
  // 배치 처리 함수 (업데이트 또는 삽입)
  async function processBatch(batch, isUpdate) {
    if (isUpdate) {
      // 업데이트 배치 처리
      const updatePromises = batch.map(async (item) => {
        // 데이터 ID 추출
        const dataId = item.id.replace('data_', '');
        
        // 메타데이터를 제외한 실제 데이터만 저장
        const allData = { ...item };
        delete allData.id;
        delete allData.shipment_number;
        delete allData.created_at;
        delete allData.created_by;
        
        // 계산서 관련 필드 확인 및 저장
        const invoiceFields = {};
        if (typeof item.isInvoiceLocked !== 'undefined') {
          invoiceFields.isInvoiceLocked = item.isInvoiceLocked;
        }
        if (typeof item.invoiceMemo !== 'undefined') {
          invoiceFields.invoiceMemo = item.invoiceMemo;
        }
        if (typeof item.invoicePassword !== 'undefined') {
          invoiceFields.invoicePassword = item.invoicePassword;
        }
        
        // JSON으로 변환하여 저장
        return pool.query(
          `UPDATE shipments_data 
           SET all_data = ?,
               isInvoiceLocked = ?,
               invoiceMemo = ?,
               invoicePassword = ?
           WHERE id = ?`,
          [JSON.stringify(allData), 
           invoiceFields.isInvoiceLocked || null, 
           invoiceFields.invoiceMemo || null, 
           invoiceFields.invoicePassword || null,
           dataId]
        );
      });
      
      return Promise.all(updatePromises);
    } else {
      // 삽입 배치 처리 - VALUES 리스트 방식으로 최적화
      if (batch.length === 0) return Promise.resolve();
      
      // 배치 삽입을 위한 값 배열과 플레이스홀더 준비
      const placeholders = [];
      const values = [];
      
      batch.forEach(item => {
        // 계산서 관련 필드 확인
        const isInvoiceLocked = item.isInvoiceLocked || null;
        const invoiceMemo = item.invoiceMemo || null;
        const invoicePassword = item.invoicePassword || null;
        
        // 필요한 기본 필드
        const 일시 = item.일시 || '';
        const 원청 = item.원청 || '';
        const 소속 = item.소속 || '';
        const 차량번호 = item.차량번호 || '';
        const 기사명 = item.기사명 || '';
        const 연락처 = item.연락처 || '';
        const 상차지 = item.상차지 || '';
        const 하차지 = item.하차지 || '';
        const 금액 = item.금액 || '';
        const source_sheet = item.sheetName || '수동 입력';
        
        // allData 객체 생성
        const allData = { ...item };
        delete allData.id;
        
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
          일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
          source_sheet, JSON.stringify(allData), req.user.id,
          isInvoiceLocked, invoiceMemo, invoicePassword
        );
      });
      
      // 배치 삽입 SQL 구성
      const sql = `
        INSERT INTO shipments_data 
        (일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
         source_sheet, all_data, created_by, isInvoiceLocked, invoiceMemo, 
         invoicePassword) 
        VALUES ${placeholders.join(',')}
      `;
      
      return pool.query(sql, values);
    }
  }
});

/**
 * @route   POST /api/shipments/save
 * @desc    배송 데이터 저장
 * @access  Private/Manager
 */
router.post('/save', [auth, managerAndAbove], async (req, res) => {
  try {
    const { shipments } = req.body;
    
    console.log(`[POST /api/shipments/save] 데이터 저장 요청 (${shipments ? shipments.length : 0}개 항목)`);
    
    if (!shipments || !Array.isArray(shipments)) {
      return res.status(400).json({ message: '유효한 데이터가 없습니다.' });
    }
    
    // 데이터 정리 - ID가 없거나 설정 데이터는 저장하지 않음
    const validData = shipments.filter(item => {
      if (!item || item.isSettingsData || !item.id) {
        return false;
      }
      return true;
    });
    
    console.log(`[POST /api/shipments/save] 유효한 데이터 ${validData.length}개 발견`);
    
    // 기존 데이터 삭제 (임시 ID 제외)
    // 임시 ID는 data_ 또는 sheet_ 로 시작하는 ID가 포함된 데이터 (데이터베이스에서 실제 INT ID를 받기 전)
    const nonTempData = validData.filter(item => 
      typeof item.id === 'number' || 
      (typeof item.id === 'string' && 
        !(item.id.startsWith('data_') || 
          item.id.startsWith('sheet_') || 
          item.id.startsWith('temp_')))
    );
    
    const tempData = validData.filter(item => 
      typeof item.id === 'string' && 
      (item.id.startsWith('data_') || 
        item.id.startsWith('sheet_') || 
        item.id.startsWith('temp_'))
    );
    
    console.log(`[POST /api/shipments/save] 기존 데이터: ${nonTempData.length}개, 임시 데이터: ${tempData.length}개`);
    
    // 대용량 데이터 처리를 위한 청크 크기 설정
    const CHUNK_SIZE = 1000;
    
    // 트랜잭션 시작
    await pool.query('START TRANSACTION');
    
    try {
      // 1. 기존 데이터 업데이트 (청크 단위로 처리)
      console.log('[POST /api/shipments/save] 기존 데이터 업데이트 시작');
      
      for (let i = 0; i < nonTempData.length; i += CHUNK_SIZE) {
        const chunk = nonTempData.slice(i, Math.min(i + CHUNK_SIZE, nonTempData.length));
        console.log(`[POST /api/shipments/save] 기존 데이터 청크 처리: ${i+1}~${Math.min(i + CHUNK_SIZE, nonTempData.length)}/${nonTempData.length}`);
        
        for (const item of chunk) {
          // 기존 항목 실존 여부 확인
          const [existCheck] = await pool.query('SELECT id FROM shipments_data WHERE id = ?', [item.id]);
          
          if (existCheck.length > 0) {
            // 데이터 JSON 변환 (일부 필드는 선별)
            const dataToStore = {
              ...item,
              id: undefined,  // ID 필드는 제외 (자동 증가)
              selected: undefined  // 선택 필드 제외
            };
            
            // 각 요소가 not null인지 검사하여 null이면 기본값 처리
            const data = JSON.stringify(dataToStore);
            
            // 업데이트 (ID로 식별)
            await pool.query(
              `UPDATE shipments_data 
              SET all_data = ?, 
                  일시 = ?, 
                  원청 = ?, 
                  소속 = ?, 
                  차량번호 = ?, 
                  기사명 = ?, 
                  연락처 = ?, 
                  상차지 = ?, 
                  하차지 = ?, 
                  금액 = ?,
                  isInvoiceLocked = ?,
                  invoiceMemo = ?,
                  invoicePassword = ?
              WHERE id = ?`,
              [
                data, 
                item.일시 || null, 
                item.원청 || null, 
                item.소속 || null, 
                item.차량번호 || null, 
                item.기사명 || null, 
                item.연락처 || null, 
                item.상차지 || null, 
                item.하차지 || null, 
                item.금액 || null,
                item.isInvoiceLocked || false,
                item.invoiceMemo || null,
                item.invoicePassword || null,
                item.id
              ]
            );
          }
        }
      }
      
      // 2. 새 데이터 삽입 (임시 ID 데이터)
      if (tempData.length > 0) {
        console.log(`[POST /api/shipments/save] 새 데이터 ${tempData.length}개 삽입 시작`);
        
        for (let i = 0; i < tempData.length; i += CHUNK_SIZE) {
          const chunk = tempData.slice(i, Math.min(i + CHUNK_SIZE, tempData.length));
          console.log(`[POST /api/shipments/save] 새 데이터 청크 처리: ${i+1}~${Math.min(i + CHUNK_SIZE, tempData.length)}/${tempData.length}`);
          
          for (const item of chunk) {
            // 데이터 JSON 변환 (일부 필드는 선별)
            const dataToStore = {
              ...item,
              id: undefined,  // ID 필드는 제외 (자동 증가)
              selected: undefined  // 선택 필드 제외
            };
            
            // JSON 데이터 직렬화
            const data = JSON.stringify(dataToStore);
            
            // 삽입
            await pool.query(
              `INSERT INTO shipments_data (
                일시, 원청, 소속, 차량번호, 기사명, 연락처, 상차지, 하차지, 금액, 
                all_data, created_by,
                isInvoiceLocked, invoiceMemo, invoicePassword
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                item.일시 || null, 
                item.원청 || null, 
                item.소속 || null, 
                item.차량번호 || null, 
                item.기사명 || null, 
                item.연락처 || null, 
                item.상차지 || null, 
                item.하차지 || null, 
                item.금액 || null,
                data, 
                req.user.id,
                item.isInvoiceLocked || false,
                item.invoiceMemo || null,
                item.invoicePassword || null
              ]
            );
          }
        }
      }
      
      // 3. 트랜잭션 커밋
      await pool.query('COMMIT');
      console.log('[POST /api/shipments/save] 데이터 저장 완료 (트랜잭션 커밋)');
      
      // 4. 저장 결과 반환
      res.status(200).json({
        message: '데이터가 성공적으로 저장되었습니다.',
        savedCount: validData.length
      });
      
    } catch (error) {
      // 오류 발생 시 롤백
      await pool.query('ROLLBACK');
      console.error('[POST /api/shipments/save] 데이터 저장 오류로 롤백:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('[POST /api/shipments/save] 서버 오류:', error);
    res.status(500).json({ message: `서버 오류: ${error.message}` });
  }
});

module.exports = router; 