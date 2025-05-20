import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Form, Row, Col, Card, InputGroup, Dropdown, Modal, ListGroup, Badge } from 'react-bootstrap';
import { FaSearch, FaPlus, FaFileExport, FaSync, FaEdit, FaLock, FaUnlock, FaFileInvoice, FaHistory, FaLayerGroup, FaMoneyBillWave } from 'react-icons/fa';
import { shipments as shipmentsAPI, server as serverAPI } from '../utils/api';

const Dashboard = ({ user }) => {
  const [shipments, setShipments] = useState([]);
  const [originalShipments, setOriginalShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  
  // useRef를 사용하여 컴포넌트 마운트 상태 추적
  const isMountedRef = useRef(true);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  
  // 계산서 모달 상태
  const [invoiceModal, setInvoiceModal] = useState({
    show: false,
    shipmentId: null,
    memo: '',
    password: '',
    isLocked: false,
    mode: 'create', // 'create' or 'unlock'
    savedMemo: ''
  });
  
  // 수정 모달 상태 추가
  const [editModal, setEditModal] = useState({
    show: false,
    shipment: null,
    editData: {}
  });
  
  // 로그 모달 상태 추가
  const [logModal, setLogModal] = useState({
    show: false,
    logs: []
  });
  
  // 컬럼 편집 모달 상태 추가
  const [columnEditModal, setColumnEditModal] = useState({
    show: false,
    columns: []
  });
  
  // 테이블 헤더 상태 관리
  const [tableColumns, setTableColumns] = useState(() => {
    // 로컬 스토리지에서 컬럼 설정 불러오기
    const savedColumns = localStorage.getItem('tableColumns');
    
    if (savedColumns) {
      try {
        return JSON.parse(savedColumns);
      } catch (error) {
        console.error('컬럼 설정 불러오기 오류:', error);
      }
    }
    
    // 기본 컬럼 설정
    return [
      { id: 'check', label: '', type: 'checkbox', visible: true },
      { id: '매출', label: '매출', visible: true },
      { id: '매입', label: '매입', visible: true },
      { id: '배차경로', label: '배차경로', visible: true },
      { id: '분류코드', label: '분류코드', visible: true },
      { id: '일시', label: '일시', visible: true },
      { id: '원청', label: '원청', visible: true },
      { id: '소속', label: '소속', visible: true },
      { id: '차량번호', label: '차량번호', visible: true },
      { id: '기사명', label: '기사명', visible: true },
      { id: '연락처', label: '연락처', visible: true },
      { id: '운송종류', label: '운송종류', visible: true },
      { id: '상차지', label: '상차지', visible: true },
      { id: '경유', label: '경유', visible: true },
      { id: '하차지', label: '하차지', visible: true },
      { id: '상차시간', label: '상차시간', visible: true },
      { id: '톤수', label: '톤수', visible: true },
      { id: '비고', label: '비고', visible: true },
      { id: '거리', label: '거리', visible: true },
      { id: '청구운임', label: '청구운임', visible: true },
      { id: '유류비1', label: '유류비1', visible: true },
      { id: '톨비2', label: '톨비2', visible: true },
      { id: '청구추가', label: '청구추가', visible: true },
      { id: '청구계', label: '청구계', visible: true },
      { id: '지급운임', label: '지급운임', visible: true },
      { id: '지급추가1', label: '지급추가1', visible: true },
      { id: '지급추가2', label: '지급추가2', visible: true },
      { id: '지급계', label: '지급계', visible: true },
      { id: '수수료율퍼센트', label: '수수료율퍼센트', visible: true },
      { id: '수수료', label: '수수료', visible: true },
      { id: '위탁수수료', label: '위탁수수료', visible: true },
      { id: '수익', label: '수익', visible: true },
      { id: '실공급액', label: '실공급액', visible: true },
      { id: '부가세', label: '부가세', visible: true },
      { id: 'action', label: '관리', visible: true }
    ];
  });
  
  // 검색 필터 상태
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    vehicleNumber: false,
    vehicleNumberValue: '',
    driverName: false,
    driverNameValue: '',
    sender: false,
    senderValue: '',
    receiver: false,
    receiverValue: '',
    contractor: false,
    contractorValue: ''
  });

  // 일괄 수정 상태
  const [bulkEdit, setBulkEdit] = useState({
    field: '',
    value: ''
  });

  // 날짜 상태 지속 기능 및 오늘 날짜 설정
  useEffect(() => {
    // 서울 시간 기준 오늘 날짜 구하기
    const today = new Date();
    // 한국 시간대(UTC+9) 설정
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    const formattedToday = koreaTime.toISOString().split('T')[0];
    
    // 저장된 페이지 사이즈 가져오기
    const savedPageSize = localStorage.getItem('pageSize');
    
    // 시작일과 종료일 모두 오늘 날짜로 설정
    setFilters(prev => ({ 
      ...prev, 
      startDate: formattedToday,
      endDate: formattedToday 
    }));
    
    // 로컬 스토리지에 날짜 저장
    localStorage.setItem('startDate', formattedToday);
    localStorage.setItem('endDate', formattedToday);
    
    // 서버에 설정 데이터 저장 (saveDataToServer 함수 사용)
    try {
      // 기존 데이터가 없는 경우에도 설정 저장을 위한 객체 생성
      const settingsData = {
        id: 'settings_config',  // 특별한 ID로 설정 데이터 구분
        isSettingsData: true,   // 설정 데이터를 식별하기 위한 플래그
        startDate: formattedToday,
        endDate: formattedToday,
        pageSize: savedPageSize ? parseInt(savedPageSize) : 30
      };
      
      // 설정 저장 (localStorage에 별도로 저장)
      localStorage.setItem('dashboard_settings', JSON.stringify(settingsData));
    } catch (error) {
      console.error('설정 저장 오류:', error);
    }
    
    if (savedPageSize) {
      setPageSize(parseInt(savedPageSize));
    }
  }, []);

  // 일시 기준 정렬 함수 (중복 코드 방지용)
  const sortByDate = (data) => {
    return [...data].sort((a, b) => {
      // 일시 데이터 형식 변환
      const getDateValue = (dateStr) => {
        if (!dateStr) return 0; // 값이 없으면 가장 마지막으로
        
        // YYMMDD 형식 처리
        if (typeof dateStr === 'string' && /^\d{6}$/.test(dateStr)) {
          const year = 2000 + parseInt(dateStr.substring(0, 2));
          const month = parseInt(dateStr.substring(2, 4)) - 1;
          const day = parseInt(dateStr.substring(4, 6));
          return new Date(year, month, day).getTime();
        }
        
        // 일반 날짜 문자열 처리
        const dateObj = new Date(dateStr);
        return isNaN(dateObj.getTime()) ? 0 : dateObj.getTime();
      };
      
      // 두 날짜 비교 (내림차순)
      const dateA = getDateValue(a['일시']);
      const dateB = getDateValue(b['일시']);
      return dateB - dateA;
    });
  };

  // fetchShipments 함수를 컴포넌트 최상위 스코프로 이동
  const fetchShipments = async () => {
    try {
      setLoading(true);
      console.log('데이터 로딩 시작');
      const res = await shipmentsAPI.getAll();
      
      if (!isMountedRef.current) return;
      
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        console.log('서버에서 데이터 로드 성공:', res.data.length);
        
        // 유효한 데이터만 필터링 (설정 데이터나 빈 데이터 제외)
        const validData = res.data.filter(item => {
          // 설정 데이터 제외
          if (item.id === 'settings_config' || item.id === 'settings_data' || item.isSettingsData === true) {
            return false;
          }
          
          // ID가 없는 데이터 또는 빈 객체 제외 (최소한의 필수 필드 확인)
          if (!item.id || Object.keys(item).length <= 1) {
            return false;
          }
          
          return true;
        });
        
        // 모든 항목이 기본적으로 선택 해제되도록 수정
        const unselectedData = validData.map(item => ({
          ...item,
          selected: false  // 항상 false로 명시적 설정
        }));
        
        // 일시 필드 기준으로 내림차순 정렬 (최신순)
        const sortedData = sortByDate(unselectedData);
        
        // 시트 데이터 처리를 위한 디버그 로그
        const sheetDataCount = sortedData.filter(item => item.id && item.id.toString().startsWith('data_')).length;
        console.log(`시트 데이터(data_ 접두사) 개수: ${sheetDataCount}개`);
        
        setShipments(sortedData);
        setOriginalShipments(sortedData);
        
        // 로컬 스토리지에도 백업
        localStorage.setItem('shipments', JSON.stringify(sortedData));
        console.log('서버 데이터를 사용하여 대시보드 표시 중');
        
        // 로컬 스토리지에서 설정 불러오기
        try {
          const savedSettings = localStorage.getItem('dashboard_settings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            
            // 저장된 날짜 정보가 있으면 사용
            if (parsedSettings.startDate && parsedSettings.endDate) {
              setFilters(prev => ({ 
                ...prev, 
                startDate: parsedSettings.startDate,
                endDate: parsedSettings.endDate 
              }));
            }
            
            // 저장된 페이지 사이즈 정보가 있으면 사용
            if (parsedSettings.pageSize) {
              setPageSize(parsedSettings.pageSize);
            }
          } else {
            // 설정 정보가 없으면 오늘 날짜 기준으로 설정
            const today = new Date();
            const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
            const formattedToday = koreaTime.toISOString().split('T')[0];
            
            setFilters(prev => ({ 
              ...prev, 
              startDate: formattedToday,
              endDate: formattedToday 
            }));
          }
          
          // 자동 필터링 제거 - 모든 데이터를 우선 표시하고 유저가 필터 버튼을 클릭하도록 함
          setLoading(false);
          
        } catch (error) {
          console.error('설정 불러오기 오류:', error);
          setLoading(false);
        }
      } else {
        console.log('서버에서 데이터를 찾을 수 없음');
        // 로컬 스토리지에서 데이터 복원 (서버 데이터가 없는 경우 백업용)
        const savedData = localStorage.getItem('shipments');
        
        if (savedData) {
          console.log('로컬 스토리지에서 데이터 복원');
          const parsedData = JSON.parse(savedData);
          // 모든 항목이 기본적으로 선택 해제되도록 수정
          const unselectedData = parsedData.map(item => ({
            ...item, 
            selected: false  // 항상 false로 명시적 설정
          }));
          
          // 일시 기준으로 정렬
          const sortedData = sortByDate(unselectedData);
          
          setShipments(sortedData);
          setOriginalShipments(sortedData);
          
          // 자동 필터링 제거
          setLoading(false);
        } else {
          console.log('로컬 스토리지에도 데이터가 없음, 빈 배열로 초기화');
          setShipments([]);
          setOriginalShipments([]);
        }
      }
      
      setLoading(false);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('데이터 로딩 오류:', error);
      
      // 서버 연결 오류시 로컬 스토리지에서 복원
      const savedData = localStorage.getItem('shipments');
      
      if (savedData) {
        console.log('서버 오류로 로컬 스토리지에서 데이터 복원');
        const parsedData = JSON.parse(savedData);
        // 모든 항목이 기본적으로 선택 해제되도록 수정
        const unselectedData = parsedData.map(item => ({
          ...item, 
          selected: false  // 항상 false로 명시적 설정
        }));
        
        // 일시 기준으로 정렬
        const sortedData = sortByDate(unselectedData);
        
        setShipments(sortedData);
        setOriginalShipments(sortedData);
        
        // 자동 필터링 제거
        setLoading(false);
      } else {
        setShipments([]);
        setOriginalShipments([]);
      }
      
      setLoading(false);
    }
  };

  // 데이터 가져오기
  useEffect(() => {
    // 컴포넌트 마운트 상태 초기화
    isMountedRef.current = true;
    
    fetchShipments();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // 페이지 관련 계산 수행
  useEffect(() => {
    if (shipments.length > 0) {
      setTotalPages(Math.ceil(shipments.length / pageSize));
      // 현재 페이지가 새로운 총 페이지 수를 초과하면 첫 페이지로 리셋
      if (currentPage > Math.ceil(shipments.length / pageSize)) {
        setCurrentPage(1);
      }
    } else {
      setTotalPages(1);
      setCurrentPage(1);
    }
  }, [shipments, pageSize, currentPage]);
  
  // 현재 페이지 데이터 계산
  const getCurrentPageData = () => {
    if (!shipments || shipments.length === 0) {
      return [];
    }
    
    try {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return shipments.slice(startIndex, endIndex);
    } catch (error) {
      console.error('페이지 데이터 계산 오류:', error);
      return [];
    }
  };

  // 페이지 이동 핸들러
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  // 페이지 사이즈 변경 핸들러
  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value);
    setPageSize(newSize);
    localStorage.setItem('pageSize', newSize.toString());
    setCurrentPage(1); // 사이즈 변경 시 첫 페이지로 이동
  };
  
  // 체크박스 선택 핸들러
  const handleCheckboxChange = (id) => {
    setShipments(
      shipments.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  // 필터 체크박스 변경 핸들러
  const handleFilterCheckChange = (e) => {
    const { id, checked } = e.target;
    const filterName = id.replace('filter-', '');
    
    if (!checked) {
      // 체크 해제 시 필터 값 초기화
      setFilters({
        ...filters,
        [filterName]: checked,
        [`${filterName}Value`]: ''
      });
    } else {
      setFilters({
        ...filters,
        [filterName]: checked
      });
    }
  };

  // 필터 값 변경 핸들러
  const handleFilterValueChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
    
    // 날짜 선택시 로컬 스토리지에 저장
    if (name === 'startDate' || name === 'endDate') {
      localStorage.setItem(name, value);
    }
  };

  // 구글시트 URL 변경 핸들러
  const handleGoogleSheetUrlChange = (e) => {
    setGoogleSheetUrl(e.target.value);
  };

  // 구글시트에서 데이터 불러오기
  const loadDataFromGoogleSheet = async () => {
    try {
      // 드라이버와 사무원은 접근 불가
      if (user.role === 'driver' || user.role === 'clerk') {
        alert('이 기능에 대한 접근 권한이 없습니다.');
        return;
      }
      
      setLoading(true);
      
      if (!googleSheetUrl || googleSheetUrl.trim() === '') {
        setLoading(false);
        alert('구글 시트 URL을 입력해주세요.');
        return;
      }

      // URL 형식 검증 (기본적인 검증)
      if (!googleSheetUrl.includes('docs.google.com/spreadsheets')) {
        setLoading(false);
        alert('올바른 구글 시트 URL을 입력해주세요.');
        return;
      }

      console.log('구글 시트 URL:', googleSheetUrl);
      
      const response = await shipmentsAPI.loadFromGoogleSheet(googleSheetUrl);
      console.log('시트 응답 데이터:', response.data);
      
      if (response && response.data && response.data.sheets && response.data.sheets.length > 0) {
        // sheets 배열에서 첫 번째 시트 데이터 가져오기
        const sheetData = response.data.sheets[0];
        const { rows, sheetTitle } = sheetData;
        
        if (!rows || rows.length === 0) {
          setLoading(false);
          alert('불러올 데이터가 없습니다. 시트 형식을 확인해주세요.');
          return;
        }
        
        // 제외할 필드 목록
        const excludedFields = ['청구계', '지급계', '수수료율퍼센트', '수수료', '위탁수수료', '수익', '실공급액', '부가세', '합계'];
        
        console.log('구글 시트 데이터 가공 시작, 총 행 수:', rows.length);
        
        // 제외 필드를 삭제하고, ID와 선택 여부 추가
        const processedData = rows.map((item, index) => {
          // 제외할 필드들을 삭제
          const processedItem = { ...item };
          excludedFields.forEach(field => {
            delete processedItem[field];
          });
          
          // 고유 ID 부여 (확실하게 구분되는 형식으로)
          // 클라이언트에서 data_ 접두사는 서버로부터 받은 데이터에만 사용하므로
          // 여기서는 temp_sheet_ 접두사를 사용
          processedItem.id = `temp_sheet_${Date.now()}_${index + 1}`;
          processedItem.selected = false; // 기본적으로 선택 해제
          
          // 원본 데이터 출처 표시
          processedItem.source = 'google_sheet';
          processedItem.sheetName = sheetTitle || '구글시트';
          
          // 날짜 확인 및 수정 - null 또는 undefined인 경우 빈 문자열로 대체
          if (processedItem['일시'] === null || processedItem['일시'] === undefined) {
            processedItem['일시'] = '';
          }
          
          return processedItem;
        });
        
        console.log('구글 시트 데이터 가공 완료, 가공된 행 수:', processedData.length);
        
        if (processedData.length === 0) {
          setLoading(false);
          alert('불러올 데이터가 없습니다. 시트 형식을 확인해주세요.');
          return;
        }
        
        // 기존 데이터와 병합 여부 확인
        if (shipments.length > 0) {
          if (window.confirm('기존 데이터를 유지하고 새 데이터를 추가하시겠습니까?\n취소하면 작업이 취소됩니다.')) {
            // 기존 데이터를 유지하고 새 데이터 추가
            const updatedShipments = [...shipments, ...processedData];
            setShipments(updatedShipments);
            setOriginalShipments(updatedShipments);
            
            // 서버에 데이터 저장
            await saveDataToServer(updatedShipments);
            
            setLoading(false);
            alert(`${processedData.length}개의 데이터가 추가되었습니다.`);
          } else {
            // 작업 취소
            setLoading(false);
            alert('데이터 추가 작업이 취소되었습니다.');
          }
        } else {
          // 기존 데이터가 없는 경우 새 데이터로 설정
          setShipments(processedData);
          setOriginalShipments(processedData);
          
          // 서버에 데이터 저장
          await saveDataToServer(processedData);
          
          setLoading(false);
          alert(`${processedData.length}개의 데이터가 로드되었습니다.`);
        }
        
        // URL 입력 필드 초기화
        setGoogleSheetUrl('');
        
        // 바로 최신 데이터를 가져오는 대신 3초 후에 fetchShipments 호출
        // 데이터베이스 저장 시간을 더 확보해줌
        setTimeout(() => {
          console.log('서버에서 데이터 다시 가져오기...');
          if (isMountedRef.current) {
            fetchShipments();
          }
        }, 3000);
      } else {
        setLoading(false);
        alert('데이터를 불러오는데 실패했습니다. 시트 형식을 확인해주세요.');
      }
    } catch (error) {
      console.error('구글 시트 데이터 로드 오류:', error);
      setLoading(false);
      alert(`데이터를 불러오는데 오류가 발생했습니다: ${error.response?.data?.message || error.message}`);
    }
  };

  // 필터 적용 핸들러
  const handleSearch = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // 오늘 날짜 구하기
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 오늘 자정으로 설정
      
      // 원본 데이터로 초기화
      let filteredData = [...originalShipments];
      
      // 날짜 필터 적용 (기본: 오늘 이후 데이터)
      const startDate = filters.startDate ? new Date(filters.startDate) : today;
      startDate.setHours(0, 0, 0, 0); // 시작일 자정으로 설정
      
      filteredData = filteredData.filter(item => {
        // 날짜 데이터 기본값은 오늘 날짜
        const itemDateStr = item['일시'] || '';
        let itemDate;
        
        // 날짜 형식이 다양할 수 있어 여러 방법으로 시도
        if (typeof itemDateStr === 'string') {
          if (/^\d{6}$/.test(itemDateStr)) {
            // YYMMDD 형식인 경우
            const year = 2000 + parseInt(itemDateStr.substring(0, 2));
            const month = parseInt(itemDateStr.substring(2, 4)) - 1;
            const day = parseInt(itemDateStr.substring(4, 6));
            itemDate = new Date(year, month, day);
          } else {
            // 일반 날짜 문자열인 경우
            itemDate = new Date(itemDateStr);
          }
        } else {
          // 숫자 등 다른 형식일 경우 기본값 사용
          return true;
        }
        
        // 날짜가 유효하지 않으면 기본적으로 포함
        if (isNaN(itemDate.getTime())) {
          return true;
        }
        
        // 종료일이 설정되어 있으면 범위 내에 있는지 확인
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999); // 종료일 마지막 시간으로 설정
          return itemDate >= startDate && itemDate <= endDate;
        }
        
        // 종료일이 없으면 시작일 이후인지만 확인
        return itemDate >= startDate;
      });
      
      // 차량번호 필터
      if (filters.vehicleNumber && filters.vehicleNumberValue) {
        filteredData = filteredData.filter(item => {
          const vehicleNumber = String(item['차량번호'] || '');
          return vehicleNumber.includes(filters.vehicleNumberValue);
        });
      }
      
      // 기사명 필터
      if (filters.driverName && filters.driverNameValue) {
        filteredData = filteredData.filter(item => {
          const driverName = String(item['기사명'] || '');
          return driverName.includes(filters.driverNameValue);
        });
      }
      
      // 상차자 필터
      if (filters.sender && filters.senderValue) {
        filteredData = filteredData.filter(item => {
          const sender = String(item['상차지'] || '');
          return sender.includes(filters.senderValue);
        });
      }
      
      // 하차자 필터
      if (filters.receiver && filters.receiverValue) {
        filteredData = filteredData.filter(item => {
          const receiver = String(item['하차지'] || '');
          return receiver.includes(filters.receiverValue);
        });
      }
      
      // 원청 필터
      if (filters.contractor && filters.contractorValue) {
        filteredData = filteredData.filter(item => {
          const contractor = String(item['원청'] || '');
          return contractor.includes(filters.contractorValue);
        });
      }
      
      // 모든 항목의 체크박스 해제 (selected: false로 설정)
      filteredData = filteredData.map(item => ({
        ...item,
        selected: false
      }));
      
      // 일시 필드 기준으로 내림차순 정렬 (최신순)
      filteredData = sortByDate(filteredData);
      
      // 필터링된 데이터 설정
      setShipments(filteredData);
      setCurrentPage(1); // 필터 적용 시 첫 페이지로 이동
      
      // 날짜 설정 저장 (로컬 스토리지)
      localStorage.setItem('startDate', filters.startDate);
      localStorage.setItem('endDate', filters.endDate);
      
      // 설정 저장 (dashboard_settings에 통합 저장)
      const settingsData = {
        id: 'settings_config',
        isSettingsData: true,
        startDate: filters.startDate,
        endDate: filters.endDate,
        pageSize: pageSize
      };
      
      localStorage.setItem('dashboard_settings', JSON.stringify(settingsData));
      
      setLoading(false);
    } catch (error) {
      console.error('필터 적용 오류:', error);
      setLoading(false);
      alert('필터를 적용하는 중 오류가 발생했습니다.');
    }
  };

  // 일괄 수정 필드 핸들러
  const handleBulkEditChange = (e) => {
    const { name, value } = e.target;
    setBulkEdit({
      ...bulkEdit,
      [name]: value
    });
  };

  // 데이터를 서버에 저장하는 함수
  const saveDataToServer = async (dataToSave) => {
    try {
      console.log('서버에 데이터 저장 시도...');
      
      // 저장 전에 설정 데이터와 빈 데이터 필터링
      const filteredData = dataToSave.filter(item => {
        // 설정 데이터 제외
        if (item.id === 'settings_config' || item.id === 'settings_data' || item.isSettingsData === true) {
          return false;
        }
        
        // ID가 없는 데이터 또는 빈 객체 제외 (최소한의 필수 필드 확인)
        if (!item.id || Object.keys(item).length <= 1) {
          return false;
        }
        
        return true;
      });
      
      // 대량 데이터를 한번에 저장할 때 문제가 발생할 수 있으므로 
      // 청크 단위로 나누어 저장
      const SAVE_CHUNK_SIZE = 1000;
      
      if (filteredData.length > SAVE_CHUNK_SIZE) {
        console.log(`대량 데이터 저장: 총 ${filteredData.length}개 데이터를 ${SAVE_CHUNK_SIZE}개씩 분할 저장`);
        
        // 데이터를 청크로 나누기
        for (let i = 0; i < filteredData.length; i += SAVE_CHUNK_SIZE) {
          const dataChunk = filteredData.slice(i, i + SAVE_CHUNK_SIZE);
          console.log(`청크 저장 중: ${i} ~ ${Math.min(i + SAVE_CHUNK_SIZE, filteredData.length)} / ${filteredData.length}`);
          
          try {
            await shipmentsAPI.saveAll(dataChunk);
          } catch (err) {
            console.error(`청크 저장 오류 (${i} ~ ${Math.min(i + SAVE_CHUNK_SIZE, filteredData.length)}):`, err);
            throw err;
          }
        }
        
        console.log('청크 저장 완료');
      } else {
        // 데이터가 적을 경우 한 번에 저장
        await shipmentsAPI.saveAll(filteredData);
      }
      
      console.log('서버에 데이터 저장 성공');
      
      // 로컬 스토리지에도 저장 (서버 접속 불가 상황 대비)
      localStorage.setItem('shipments', JSON.stringify(filteredData));
    } catch (error) {
      console.error('서버에 데이터 저장 실패:', error);
      // 서버 저장 실패 시에도 로컬 스토리지에 저장
      localStorage.setItem('shipments', JSON.stringify(dataToSave));
      throw error;
    }
  };
  
  // 일괄 수정 적용 핸들러
  const applyBulkEdit = async () => {
    // 드라이버와 사무원은 접근 불가
    if (user.role === 'driver' || user.role === 'clerk') {
      alert('이 기능에 대한 접근 권한이 없습니다.');
      return;
    }
    
    if (!bulkEdit.field || !bulkEdit.value) {
      alert('수정할 항목과 값을 모두 입력해주세요.');
      return;
    }
    
    // 선택된 항목 확인
    const selectedItems = shipments.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      alert('수정할 항목을 먼저 선택해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      
      // 선택된 아이템의 ID 목록 추출
      const selectedIds = selectedItems.map(item => item.id);
      console.log(`일괄 수정 시작: ${selectedIds.length}개 항목 수정 중...`);
      
      // 청구계 관련 필드를 일괄 수정하는지 확인
      const isChangingBillingRelatedField = ['청구운임', '유류비1', '톨비2', '청구추가'].includes(bulkEdit.field);
      
      // 지급계 관련 필드를 일괄 수정하는지 확인
      const isChangingPaymentRelatedField = ['지급운임', '지급추가1', '지급추가2'].includes(bulkEdit.field);
      
      // 대량 데이터 처리를 위해 청크 단위로 나누어 처리
      const CHUNK_SIZE = 500; // 한 번에 500개씩 처리
      const updatedShipments = [...shipments];
      
      for (let i = 0; i < updatedShipments.length; i += CHUNK_SIZE) {
        const chunk = updatedShipments.slice(i, i + CHUNK_SIZE);
        
        // 각 청크를 병렬 처리하지 않고 순차적으로 처리 (메모리 이슈 방지)
        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          if (item.selected) {
            // 일괄 수정 로그 추가 - 변경된 필드만 기록 (자동 계산 필드는 제외)
            const editLog = {
              timestamp: new Date().toISOString(),
              editorName: user.username,
              editorRole: user.role,
              changedFields: [bulkEdit.field],
              oldValues: { [bulkEdit.field]: item[bulkEdit.field] },
              newValues: { [bulkEdit.field]: bulkEdit.value },
              isBulkEdit: true  // 일괄 수정 표시
            };
            
            // 일괄 수정된 데이터 객체 초기화
            item[bulkEdit.field] = bulkEdit.value;
            item.logs = item.logs ? [...item.logs, editLog] : [editLog];
            
            // 청구계 관련 필드가 수정될 때 청구계도 자동 재계산
            if (isChangingBillingRelatedField) {
              // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
              const 청구운임 = parseFloat(bulkEdit.field === '청구운임' ? bulkEdit.value : item['청구운임']) || 0;
              const 유류비1 = parseFloat(bulkEdit.field === '유류비1' ? bulkEdit.value : item['유류비1']) || 0;
              const 톨비2 = parseFloat(bulkEdit.field === '톨비2' ? bulkEdit.value : item['톨비2']) || 0;
              const 청구추가 = parseFloat(bulkEdit.field === '청구추가' ? bulkEdit.value : item['청구추가']) || 0;
              
              // 청구계 계산
              const 청구계 = 청구운임 + 유류비1 + 톨비2 + 청구추가;
              
              // 자동 계산된 필드 관리
              const autoCalculatedFields = item.autoCalculatedFields || [];
              if (!autoCalculatedFields.includes('청구계')) {
                autoCalculatedFields.push('청구계');
              }
              
              item['청구계'] = 청구계;
              item.autoCalculatedFields = autoCalculatedFields;
            }
            
            // 지급계 관련 필드가 수정될 때 지급계도 자동 재계산
            if (isChangingPaymentRelatedField) {
              // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
              const 지급운임 = parseFloat(bulkEdit.field === '지급운임' ? bulkEdit.value : item['지급운임']) || 0;
              const 지급추가1 = parseFloat(bulkEdit.field === '지급추가1' ? bulkEdit.value : item['지급추가1']) || 0;
              const 지급추가2 = parseFloat(bulkEdit.field === '지급추가2' ? bulkEdit.value : item['지급추가2']) || 0;
              
              // 지급계 계산
              const 지급계 = 지급운임 + 지급추가1 + 지급추가2;
              
              // 자동 계산된 필드 관리
              const autoCalculatedFields = item.autoCalculatedFields || [];
              if (!autoCalculatedFields.includes('지급계')) {
                autoCalculatedFields.push('지급계');
              }
              
              item['지급계'] = 지급계;
              item.autoCalculatedFields = autoCalculatedFields;
            }
          }
        }
        
        // 청크 처리 상태 로깅 (디버깅용)
        console.log(`청크 처리 완료: ${i} ~ ${Math.min(i + CHUNK_SIZE, updatedShipments.length)} / ${updatedShipments.length}`);
      }
      
      // 상태 업데이트는 모든 처리가 끝난 후 한 번만 수행
      setShipments(updatedShipments);
      
      // 원본 데이터도 업데이트 (필터 초기화 시 일괄 수정 내용이 유지되도록)
      const updatedOriginals = originalShipments.map(item => {
        if (item.selected) {
          // 업데이트된 shipments에서 해당 아이템 찾기
          const updatedItem = updatedShipments.find(updated => updated.id === item.id);
          if (updatedItem) {
            return updatedItem;
          }
        }
        return item;
      });
      
      setOriginalShipments(updatedOriginals);
      
      // 대량 데이터를 청크로 나누어 서버에 저장
      try {
        console.log('서버에 데이터 저장 시작...');
        await saveDataToServer(updatedOriginals);
        console.log('서버에 데이터 저장 완료');
      } catch (err) {
        console.error('서버 저장 오류:', err);
        alert('일부 데이터가 서버에 저장되지 않았을 수 있습니다. 나중에 다시 시도해주세요.');
      }
      
      // 수정 후 필드 초기화
      setBulkEdit({
        field: '',
        value: ''
      });
      
      setLoading(false);
      
      alert(`선택한 ${selectedItems.length}개 항목의 ${bulkEdit.field}을(를) ${bulkEdit.value}(으)로 일괄 수정했습니다.`);
    } catch (error) {
      setLoading(false);
      console.error('일괄 수정 오류:', error);
      alert(`일괄 수정 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // 수정 가능한 필드 목록 - 동적으로 시트에서 불러온 헤더와 일치하게
  const getEditableFields = () => {
    // 기본 필드 (시트 데이터가 없을 때)
    const defaultFields = [
      { value: '차량번호', label: '차량번호' },
      { value: '기사명', label: '기사명' },
      { value: '상차지', label: '상차지' },
      { value: '하차지', label: '하차지' },
      { value: '원청', label: '원청' }
    ];
    
    // 테이블 컬럼이 기본값보다 많으면 시트에서 불러온 값 사용
    if (tableColumns.length > 3) {
      return tableColumns
        .filter(col => 
          col.id !== 'check' && 
          col.id !== 'action' && 
          col.id !== '청구계' && 
          col.id !== '지급계' && 
          col.id !== '실공급액'
        )
        .map(col => ({ value: col.id, label: col.label }));
    }
    
    return defaultFields;
  };
  
  // 페이지네이션 번호 렌더링
  const renderPaginationNumbers = () => {
    const pages = [];
    
    // 이전 페이지 버튼
    pages.push(
      <Button 
        key="prev" 
        variant="outline-primary" 
        size="sm" 
        className="me-1 py-0 px-2"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{fontSize: '1.2rem'}}
      >
        이전
      </Button>
    );
    
    // 페이지 그룹 계산 (현재 페이지를 중심으로 최대 10개)
    let startPage = Math.max(1, currentPage - 5);
    let endPage = Math.min(startPage + 9, totalPages);
    
    // 시작 페이지 조정 (항상 10개가 표시되도록)
    if (endPage - startPage < 9 && startPage > 1) {
      startPage = Math.max(1, endPage - 9);
    }
    
    // 처음 페이지 버튼 (시작 페이지가 1이 아닌 경우에만 표시)
    if (startPage > 1) {
      pages.push(
        <Button 
          key={1} 
          variant="outline-primary" 
          size="sm" 
          className="me-1 py-0 px-2"
          onClick={() => handlePageChange(1)}
          style={{fontSize: '1.2rem'}}
        >
          1
        </Button>
      );
      
      // 생략 표시 (처음 페이지와 현재 페이지 그룹 사이에 간격이 있을 경우)
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="mx-1">...</span>
        );
      }
    }
    
    // 페이지 번호 버튼
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button 
          key={i} 
          variant={i === currentPage ? "primary" : "outline-primary"} 
          size="sm" 
          className="me-1 py-0 px-2"
          onClick={() => handlePageChange(i)}
          style={{fontSize: '1.2rem'}}
        >
          {i}
        </Button>
      );
    }
    
    // 마지막 페이지 버튼 (현재 페이지 그룹의 마지막이 totalPages가 아닌 경우에만 표시)
    if (endPage < totalPages) {
      // 생략 표시 (현재 페이지 그룹과 마지막 페이지 사이에 간격이 있을 경우)
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="mx-1">...</span>
        );
      }
      
      pages.push(
        <Button 
          key={totalPages} 
          variant="outline-primary" 
          size="sm" 
          className="me-1 py-0 px-2"
          onClick={() => handlePageChange(totalPages)}
          style={{fontSize: '1.2rem'}}
        >
          {totalPages}
        </Button>
      );
    }
    
    // 다음 페이지 버튼
    pages.push(
      <Button 
        key="next" 
        variant="outline-primary" 
        size="sm" 
        className="py-0 px-2"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{fontSize: '1.2rem'}}
      >
        다음
      </Button>
    );
    
    return pages;
  };

  // 데이터 전체 선택 핸들러 추가
  const handleSelectAllChange = (e) => {
    const isChecked = e.target.checked;
    setShipments(
      shipments.map(item => ({
        ...item,
        selected: isChecked
      }))
    );
  };

  // 현재 검색 결과 전체 선택
  const selectAllSearchResults = () => {
    setShipments(
      shipments.map(item => ({
        ...item,
        selected: true
      }))
    );
  };

  // 선택 항목 삭제
  const deleteSelectedItems = async () => {
    // 드라이버와 사무원은 접근 불가
    if (user.role === 'driver' || user.role === 'clerk') {
      alert('이 기능에 대한 접근 권한이 없습니다.');
      return;
    }
    
    const selectedItems = shipments.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert('삭제할 항목을 먼저 선택해주세요.');
      return;
    }
    
    if (window.confirm(`선택한 ${selectedItems.length}개 항목을 삭제하시겠습니까?`)) {
      try {
        setLoading(true);
        
        // 선택되지 않은 항목만 필터링
        const updatedShipments = shipments.filter(item => !item.selected);
        const updatedOriginals = originalShipments.filter(item => 
          !selectedItems.find(selected => selected.id === item.id)
        );
        
        // 상태 업데이트
        setShipments(updatedShipments);
        setOriginalShipments(updatedOriginals);
        
        // 서버에 변경 사항 저장 (삭제된 항목이 반영됨)
        await saveDataToServer(updatedOriginals);
        console.log('삭제한 항목이 서버에 반영되었습니다.');
        
        // 로컬 스토리지에도 업데이트
        localStorage.setItem('shipments', JSON.stringify(updatedOriginals));
        
        // 삭제된 항목 ID 로깅
        const deletedIds = selectedItems.map(item => item.id);
        console.log('삭제된 항목 ID:', deletedIds);
        
        setLoading(false);
        alert(`${selectedItems.length}개 항목이 삭제되었습니다.`);
      } catch (error) {
        console.error('항목 삭제 중 오류 발생:', error);
        setLoading(false);
        alert('항목 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  // 계산서 버튼 클릭 핸들러
  const handleInvoiceClick = (shipment) => {
    // 이미 잠김 상태인지 확인
    if (shipment.isInvoiceLocked) {
      // 잠김 상태면 비밀번호 입력 모드로 열기
      setInvoiceModal({
        show: true,
        shipmentId: shipment.id,
        memo: '',
        password: '',
        isLocked: true,
        mode: 'unlock',
        savedMemo: shipment.invoiceMemo || ''
      });
    } else {
      // 잠김 상태가 아니면 새로 생성 모드로 열기
      setInvoiceModal({
        show: true,
        shipmentId: shipment.id,
        memo: '',
        password: '',
        isLocked: false,
        mode: 'create',
        savedMemo: ''
      });
    }
  };

  // 계산서 모달 내용 입력 핸들러
  const handleInvoiceModalChange = (e) => {
    const { name, value } = e.target;
    setInvoiceModal({
      ...invoiceModal,
      [name]: value
    });
  };

  // 계산서 처리 저장 핸들러
  const handleInvoiceSave = async () => {
    try {
      setLoading(true);
      
      if (invoiceModal.mode === 'create') {
        // 기본 비밀번호 설정
        const password = "0000";
        
        // API 호출 (실제 서버와 통신)
        try {
          await shipmentsAPI.createInvoice(invoiceModal.shipmentId, invoiceModal.memo, password);
        } catch (error) {
          console.error('계산서 처리 서버 통신 오류:', error);
          // 서버 오류 시에도 UI는 계속 업데이트
        }
        
        // 로컬 상태 업데이트
        const updatedShipments = shipments.map(item => {
          if (item.id === invoiceModal.shipmentId) {
            return { 
              ...item, 
              isInvoiceLocked: true,
              invoiceMemo: invoiceModal.memo,
              invoicePassword: password
            };
          }
          return item;
        });
        
        setShipments(updatedShipments);
        
        // 원본 데이터도 업데이트
        const updatedOriginalShipments = originalShipments.map(item => {
          if (item.id === invoiceModal.shipmentId) {
            return { 
              ...item, 
              isInvoiceLocked: true,
              invoiceMemo: invoiceModal.memo,
              invoicePassword: password
            };
          }
          return item;
        });
        
        setOriginalShipments(updatedOriginalShipments);
        
        // 서버에 데이터 저장
        await saveDataToServer(updatedOriginalShipments);
        
        alert('계산서가 처리되었습니다.');
      } else if (invoiceModal.mode === 'unlock') {
        // 비밀번호 확인
        const shipment = shipments.find(item => item.id === invoiceModal.shipmentId);
        
        if (shipment && shipment.invoicePassword === invoiceModal.password) {
          // 비밀번호가 맞으면 잠금 해제
          const updatedShipments = shipments.map(item => {
            if (item.id === invoiceModal.shipmentId) {
              return { 
                ...item, 
                isInvoiceLocked: false
              };
            }
            return item;
          });
          
          setShipments(updatedShipments);
          
          // 원본 데이터도 업데이트
          const updatedOriginalShipments = originalShipments.map(item => {
            if (item.id === invoiceModal.shipmentId) {
              return { 
                ...item, 
                isInvoiceLocked: false
              };
            }
            return item;
          });
          
          setOriginalShipments(updatedOriginalShipments);
          
          // 서버에 데이터 저장
          await saveDataToServer(updatedOriginalShipments);
          
          alert('계산서 잠금이 해제되었습니다.');
        } else {
          alert('비밀번호가 일치하지 않습니다.');
          setLoading(false);
          return;
        }
      }
      
      // 모달 닫기
      setInvoiceModal({
        show: false,
        shipmentId: null,
        memo: '',
        password: '',
        isLocked: false,
        mode: 'create',
        savedMemo: ''
      });
      
      setLoading(false);
    } catch (error) {
      console.error('계산서 처리 오류:', error);
      setLoading(false);
      alert('계산서 처리 중 오류가 발생했습니다.');
    }
  };

  // 계산서 모달 닫기 핸들러
  const handleInvoiceModalClose = () => {
    setInvoiceModal({
      show: false,
      shipmentId: null,
      memo: '',
      password: '',
      isLocked: false,
      mode: 'create',
      savedMemo: ''
    });
  };

  // 수정 모달 열기 핸들러
  const handleOpenEditModal = (shipment) => {
    // 수정할 데이터로 초기화
    setEditModal({
      show: true,
      shipment: shipment,
      editData: { ...shipment }
    });
  };
  
  // 수정 모달 닫기 핸들러
  const handleCloseEditModal = () => {
    setEditModal({
      show: false,
      shipment: null,
      editData: {}
    });
  };
  
  // 수정 모달 입력 변경 핸들러
  const handleEditModalChange = (e) => {
    const { name, value } = e.target;
    
    // 현재 입력 중인 값을 포함하여 업데이트된 데이터 생성
    const updatedEditData = {
      ...editModal.editData,
      [name]: value
    };
    
    // 청구계 관련 필드가 수정되면 청구계 자동 재계산
    if (['청구운임', '유류비1', '톨비2', '청구추가'].includes(name) && editModal.shipment) {
      // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
      const 청구운임 = parseFloat(updatedEditData['청구운임']) || 0;
      const 유류비1 = parseFloat(updatedEditData['유류비1']) || 0;
      const 톨비2 = parseFloat(updatedEditData['톨비2']) || 0;
      const 청구추가 = parseFloat(updatedEditData['청구추가']) || 0;
      
      // 청구계 계산
      const 청구계 = 청구운임 + 유류비1 + 톨비2 + 청구추가;
      
      // 수정 모달의 청구계 값도 업데이트
      updatedEditData['청구계'] = 청구계;
      
      // 자동 계산된 필드 표시를 위한 속성 추가
      if (!updatedEditData.autoCalculatedFields) {
        updatedEditData.autoCalculatedFields = [...(editModal.shipment.autoCalculatedFields || [])];
      }
      if (!updatedEditData.autoCalculatedFields.includes('청구계')) {
        updatedEditData.autoCalculatedFields.push('청구계');
      }
    }
    
    // 지급계 관련 필드가 수정되면 지급계 자동 재계산
    if (['지급운임', '지급추가1', '지급추가2'].includes(name) && editModal.shipment) {
      // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
      const 지급운임 = parseFloat(updatedEditData['지급운임']) || 0;
      const 지급추가1 = parseFloat(updatedEditData['지급추가1']) || 0;
      const 지급추가2 = parseFloat(updatedEditData['지급추가2']) || 0;
      
      // 지급계 계산
      const 지급계 = 지급운임 + 지급추가1 + 지급추가2;
      
      // 수정 모달의 지급계 값도 업데이트
      updatedEditData['지급계'] = 지급계;
      
      // 자동 계산된 필드 표시를 위한 속성 추가
      if (!updatedEditData.autoCalculatedFields) {
        updatedEditData.autoCalculatedFields = [...(editModal.shipment.autoCalculatedFields || [])];
      }
      if (!updatedEditData.autoCalculatedFields.includes('지급계')) {
        updatedEditData.autoCalculatedFields.push('지급계');
      }
    }
    
    // 업데이트된 데이터로 상태 업데이트
    setEditModal(prev => ({
      ...prev,
      editData: updatedEditData
    }));
  };
  
  // 수정 데이터 저장 핸들러
  const handleSaveEdit = async () => {
    try {
      setLoading(true);
      
      const { shipment, editData } = editModal;
      
      // 변경 사항 찾기
      const changes = {};
      const changedFields = [];
      
      Object.keys(editData).forEach(key => {
        if (editData[key] !== shipment[key] && key !== 'id' && key !== 'selected' && key !== 'autoCalculatedFields') {
          changes[key] = editData[key];
          changedFields.push(key);
        }
      });
      
      if (changedFields.length === 0) {
        setLoading(false);
        alert('변경된 내용이 없습니다.');
        return;
      }
      
      // 청구계 관련 필드가 수정되는지 확인
      const isChangingBillingRelatedField = changedFields.some(field => 
        ['청구운임', '유류비1', '톨비2', '청구추가'].includes(field)
      );
      
      // 청구계 관련 필드 변경 시 청구계 자동 재계산
      if (isChangingBillingRelatedField) {
        // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
        const 청구운임 = parseFloat(editData['청구운임']) || 0;
        const 유류비1 = parseFloat(editData['유류비1']) || 0;
        const 톨비2 = parseFloat(editData['톨비2']) || 0;
        const 청구추가 = parseFloat(editData['청구추가']) || 0;
        
        // 청구계 계산
        const 청구계 = 청구운임 + 유류비1 + 톨비2 + 청구추가;
        
        // 변경 사항에 청구계 추가 (로그에는 추가하지 않음)
        changes['청구계'] = 청구계;
      }
      
      // 지급계 관련 필드가 수정되는지 확인
      const isChangingPaymentRelatedField = changedFields.some(field => 
        ['지급운임', '지급추가1', '지급추가2'].includes(field)
      );
      
      // 지급계 관련 필드 변경 시 지급계 자동 재계산
      if (isChangingPaymentRelatedField) {
        // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
        const 지급운임 = parseFloat(editData['지급운임']) || 0;
        const 지급추가1 = parseFloat(editData['지급추가1']) || 0;
        const 지급추가2 = parseFloat(editData['지급추가2']) || 0;
        
        // 지급계 계산
        const 지급계 = 지급운임 + 지급추가1 + 지급추가2;
        
        // 변경 사항에 지급계 추가 (로그에는 추가하지 않음)
        changes['지급계'] = 지급계;
      }

      // 로그에 기록할 필드만 필터링 (자동 계산된 청구계, 지급계 제외)
      const loggedFields = changedFields.filter(field => field !== '청구계' && field !== '지급계');
      
      // 자동 계산된 필드 정보 가져오기 (모달에서 업데이트된 정보 사용)
      const newAutoCalculatedFields = editData.autoCalculatedFields || [];
      
      // 로컬 상태 업데이트
      const updatedShipments = shipments.map(item => {
        if (item.id === shipment.id) {
          // 수정 로그 추가 - 자동 계산된 필드 제외
          const editLog = {
            timestamp: new Date().toISOString(),
            editorName: user.username,
            editorRole: user.role,
            changedFields: loggedFields,
            oldValues: loggedFields.reduce((obj, field) => {
              obj[field] = shipment[field];
              return obj;
            }, {}),
            newValues: loggedFields.reduce((obj, field) => {
              obj[field] = editData[field];
              return obj;
            }, {})
          };
          
          // 업데이트된 항목 준비
          const updatedItem = { 
            ...item, 
            ...changes,
            logs: item.logs ? [...item.logs, editLog] : [editLog]
          };
          
          // 청구계 또는 지급계가 포함된 경우 자동 계산된 필드 목록 업데이트
          if (isChangingBillingRelatedField || isChangingPaymentRelatedField) {
            // 기존 자동 계산 필드 목록 유지하면서 새로운 필드 추가
            updatedItem.autoCalculatedFields = [...new Set([
              ...(item.autoCalculatedFields || []),
              ...newAutoCalculatedFields
            ])];
          }
          
          return updatedItem;
        }
        return item;
      });
      
      setShipments(updatedShipments);
      
      // 원본 데이터도 업데이트 (필터 초기화 시 일괄 수정 내용이 유지되도록)
      const updatedOriginals = originalShipments.map(item => {
        const matchedItem = updatedShipments.find(updated => updated.id === item.id);
        if (matchedItem && matchedItem.id === shipment.id) {
          // 원본 데이터도 업데이트
          return matchedItem;
        }
        return item;
      });
      
      setOriginalShipments(updatedOriginals);
      
      // 서버에 데이터 저장
      await saveDataToServer(updatedOriginals);
      
      // 모달 닫기
      handleCloseEditModal();
      
      setLoading(false);
      alert('데이터가 수정되었습니다.');
    } catch (error) {
      console.error('데이터 수정 오류:', error);
      setLoading(false);
      alert('데이터 수정 중 오류가 발생했습니다.');
    }
  };
  
  // 로그 모달 열기 핸들러
  const handleOpenLogModal = (shipment) => {
    setLogModal({
      show: true,
      logs: shipment.logs || []
    });
  };
  
  // 로그 모달 닫기 핸들러
  const handleCloseLogModal = () => {
    setLogModal({
      show: false,
      logs: []
    });
  };

  // 로그인 상태 확인 및 서버 재시작 감지
  useEffect(() => {
    // 서버 연결 확인 (서버 재시작 감지용)
    const checkServer = async () => {
      try {
        await serverAPI.checkHealth();
        console.log('서버 상태 확인 성공');
      } catch (error) {
        console.error('서버 연결 오류:', error);
      }
    };
    
    checkServer();
    
    // 주기적으로 서버 상태 확인 (1분마다)
    const interval = setInterval(checkServer, 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 드라이버, 사무원 권한 체크 함수
  const hasEditPermission = () => {
    return user.role !== 'driver' && user.role !== 'clerk';
  };

  // 청구계 자동 계산 함수
  const calculateBillingTotal = () => {
    if (!hasEditPermission()) {
      alert('이 기능에 대한 접근 권한이 없습니다.');
      return;
    }
    
    if (window.confirm('선택된 항목의 청구계를 자동으로 계산하시겠습니까?\n(청구운임 + 유류비1 + 톨비2 + 청구추가)')) {
      const selectedItems = shipments.filter(item => item.selected);
      
      if (selectedItems.length === 0) {
        alert('청구계를 계산할 항목을 먼저 선택해주세요.');
        return;
      }
      
      // 선택된 항목에 대해 청구계 계산 및 업데이트
      const updatedShipments = shipments.map(item => {
        if (item.selected) {
          // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
          const 청구운임 = parseFloat(item['청구운임']) || 0;
          const 유류비1 = parseFloat(item['유류비1']) || 0;
          const 톨비2 = parseFloat(item['톨비2']) || 0;
          const 청구추가 = parseFloat(item['청구추가']) || 0;
          
          // 청구계 계산
          const 청구계 = 청구운임 + 유류비1 + 톨비2 + 청구추가;
          
          // 자동 계산된 필드 관리
          const autoCalculatedFields = item.autoCalculatedFields || [];
          if (!autoCalculatedFields.includes('청구계')) {
            autoCalculatedFields.push('청구계');
          }
          
          return { 
            ...item, 
            '청구계': 청구계,
            autoCalculatedFields: autoCalculatedFields
          };
        }
        return item;
      });
      
      setShipments(updatedShipments);
      
      // 원본 데이터도 업데이트
      const updatedOriginalShipments = originalShipments.map(item => {
        const matchedItem = updatedShipments.find(updated => updated.id === item.id);
        if (matchedItem && matchedItem.selected) {
          // 원본 데이터도 업데이트
          return matchedItem;
        }
        return item;
      });
      
      setOriginalShipments(updatedOriginalShipments);
      
      // 서버에 데이터 저장
      saveDataToServer(updatedOriginalShipments);
      
      alert(`선택한 ${selectedItems.length}개 항목의 청구계가 자동 계산되었습니다.`);
    }
  };
  
  // 지급계 자동 계산 함수
  const calculatePaymentTotal = () => {
    if (!hasEditPermission()) {
      alert('이 기능에 대한 접근 권한이 없습니다.');
      return;
    }
    
    if (window.confirm('선택된 항목의 지급계를 자동으로 계산하시겠습니까?\n(지급운임 + 지급추가1 + 지급추가2)')) {
      const selectedItems = shipments.filter(item => item.selected);
      
      if (selectedItems.length === 0) {
        alert('지급계를 계산할 항목을 먼저 선택해주세요.');
        return;
      }
      
      // 선택된 항목에 대해 지급계 계산 및 업데이트
      const updatedShipments = shipments.map(item => {
        if (item.selected) {
          // 값들을 숫자로 변환 (비숫자 값은 0으로 처리)
          const 지급운임 = parseFloat(item['지급운임']) || 0;
          const 지급추가1 = parseFloat(item['지급추가1']) || 0;
          const 지급추가2 = parseFloat(item['지급추가2']) || 0;
          
          // 지급계 계산
          const 지급계 = 지급운임 + 지급추가1 + 지급추가2;
          
          // 자동 계산된 필드 관리
          const autoCalculatedFields = item.autoCalculatedFields || [];
          if (!autoCalculatedFields.includes('지급계')) {
            autoCalculatedFields.push('지급계');
          }
          
          return { 
            ...item, 
            '지급계': 지급계,
            autoCalculatedFields: autoCalculatedFields
          };
        }
        return item;
      });
      
      setShipments(updatedShipments);
      
      // 원본 데이터도 업데이트
      const updatedOriginalShipments = originalShipments.map(item => {
        const matchedItem = updatedShipments.find(updated => updated.id === item.id);
        if (matchedItem && matchedItem.selected) {
          // 원본 데이터도 업데이트
          return matchedItem;
        }
        return item;
      });
      
      setOriginalShipments(updatedOriginalShipments);
      
      // 서버에 데이터 저장
      saveDataToServer(updatedOriginalShipments);
      
      alert(`선택한 ${selectedItems.length}개 항목의 지급계가 자동 계산되었습니다.`);
    }
  };

  // 컬럼 편집 모달 열기 핸들러
  const handleOpenColumnEditModal = () => {
    setColumnEditModal({
      show: true,
      columns: [...tableColumns]
    });
  };
  
  // 컬럼 편집 모달 닫기 핸들러
  const handleCloseColumnEditModal = () => {
    setColumnEditModal({
      show: false,
      columns: []
    });
  };
  
  // 컬럼 표시 여부 변경 핸들러
  const handleColumnVisibilityChange = (columnId) => {
    setColumnEditModal(prev => ({
      ...prev,
      columns: prev.columns.map(col => 
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    }));
  };
  
  // 컬럼 설정 저장 핸들러
  const handleSaveColumnSettings = () => {
    // 컬럼 설정 업데이트
    setTableColumns(columnEditModal.columns);
    
    // 로컬 스토리지에 저장
    localStorage.setItem('tableColumns', JSON.stringify(columnEditModal.columns));
    
    // 모달 닫기
    handleCloseColumnEditModal();
  };
  
  // 컬럼 설정 초기화 핸들러
  const handleResetColumnSettings = () => {
    // 기본 컬럼 설정으로 초기화
    const defaultColumns = [
      { id: 'check', label: '', type: 'checkbox', visible: true },
      { id: '매출', label: '매출', visible: true },
      { id: '매입', label: '매입', visible: true },
      { id: '배차경로', label: '배차경로', visible: true },
      { id: '분류코드', label: '분류코드', visible: true },
      { id: '일시', label: '일시', visible: true },
      { id: '원청', label: '원청', visible: true },
      { id: '소속', label: '소속', visible: true },
      { id: '차량번호', label: '차량번호', visible: true },
      { id: '기사명', label: '기사명', visible: true },
      { id: '연락처', label: '연락처', visible: true },
      { id: '운송종류', label: '운송종류', visible: true },
      { id: '상차지', label: '상차지', visible: true },
      { id: '경유', label: '경유', visible: true },
      { id: '하차지', label: '하차지', visible: true },
      { id: '상차시간', label: '상차시간', visible: true },
      { id: '톤수', label: '톤수', visible: true },
      { id: '비고', label: '비고', visible: true },
      { id: '거리', label: '거리', visible: true },
      { id: '청구운임', label: '청구운임', visible: true },
      { id: '유류비1', label: '유류비1', visible: true },
      { id: '톨비2', label: '톨비2', visible: true },
      { id: '청구추가', label: '청구추가', visible: true },
      { id: '청구계', label: '청구계', visible: true },
      { id: '지급운임', label: '지급운임', visible: true },
      { id: '지급추가1', label: '지급추가1', visible: true },
      { id: '지급추가2', label: '지급추가2', visible: true },
      { id: '지급계', label: '지급계', visible: true },
      { id: '수수료율퍼센트', label: '수수료율퍼센트', visible: true },
      { id: '수수료', label: '수수료', visible: true },
      { id: '위탁수수료', label: '위탁수수료', visible: true },
      { id: '수익', label: '수익', visible: true },
      { id: '실공급액', label: '실공급액', visible: true },
      { id: '부가세', label: '부가세', visible: true },
      { id: 'action', label: '관리', visible: true }
    ];
    
    setColumnEditModal(prev => ({
      ...prev,
      columns: defaultColumns
    }));
  };

  // 날짜 기준 필터링 함수 (초기 로딩시 자동 필터 적용)
  const handleFilterByDate = (data) => {
    try {
      // 현재 설정된 날짜 가져오기
      const startDateStr = filters.startDate;
      const endDateStr = filters.endDate;
      
      if (!startDateStr) {
        // 시작일이 없으면 모든 데이터 표시
        setShipments(data);
        console.log("시작일이 없어 모든 데이터 표시");
        return;
      }
      
      // 원본 데이터로 초기화
      let filteredData = [...data];
      
      // 날짜 필터 적용
      const startDate = new Date(startDateStr);
      startDate.setHours(0, 0, 0, 0); // 시작일 자정으로 설정
      
      // 필터링 전 원본 데이터 개수 로깅
      console.log(`필터링 전 데이터 개수: ${filteredData.length}개`);
      
      // 날짜 파싱 시 실패 카운터
      let parseFailCount = 0;
      
      filteredData = filteredData.filter(item => {
        // 날짜 데이터가 없으면 기본적으로 포함 (필터링하지 않음)
        const itemDateStr = item['일시'] || '';
        if (!itemDateStr) return true;
        
        let itemDate;
        
        // 날짜 형식이 다양할 수 있어 여러 방법으로 시도
        if (typeof itemDateStr === 'string') {
          if (/^\d{6}$/.test(itemDateStr)) {
            // YYMMDD 형식인 경우
            const year = 2000 + parseInt(itemDateStr.substring(0, 2));
            const month = parseInt(itemDateStr.substring(2, 4)) - 1;
            const day = parseInt(itemDateStr.substring(4, 6));
            itemDate = new Date(year, month, day);
          } else if (/^\d{8}$/.test(itemDateStr)) {
            // YYYYMMDD 형식인 경우
            const year = parseInt(itemDateStr.substring(0, 4));
            const month = parseInt(itemDateStr.substring(4, 6)) - 1;
            const day = parseInt(itemDateStr.substring(6, 8));
            itemDate = new Date(year, month, day);
          } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(itemDateStr)) {
            // YY/MM/DD 형식인 경우
            const parts = itemDateStr.split('/');
            const year = 2000 + parseInt(parts[2]);
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            itemDate = new Date(year, month, day);
          } else if (/^\d{2}-\d{2}-\d{2}$/.test(itemDateStr)) {
            // YY-MM-DD 형식인 경우
            const parts = itemDateStr.split('-');
            const year = 2000 + parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            itemDate = new Date(year, month, day);
          } else {
            // 일반 날짜 문자열인 경우
            itemDate = new Date(itemDateStr);
          }
        } else {
          // 숫자 등 다른 형식일 경우 기본값 사용
          return true;
        }
        
        // 날짜가 유효하지 않으면 기본적으로 포함
        if (isNaN(itemDate.getTime())) {
          parseFailCount++;
          return true;
        }
        
        // 종료일이 설정되어 있으면 범위 내에 있는지 확인
        if (endDateStr) {
          const endDate = new Date(endDateStr);
          endDate.setHours(23, 59, 59, 999); // 종료일 마지막 시간으로 설정
          return itemDate >= startDate && itemDate <= endDate;
        }
        
        // 종료일이 없으면 시작일 이후인지만 확인
        return itemDate >= startDate;
      });
      
      // 날짜 파싱 실패 로그
      if (parseFailCount > 0) {
        console.log(`날짜 파싱 실패 항목: ${parseFailCount}개`);
      }
      
      // 필터링 후 데이터 개수 로깅
      console.log(`필터링 후 데이터 개수: ${filteredData.length}개`);
      
      // 데이터가 없으면 원본 데이터 표시
      if (filteredData.length === 0) {
        console.log("필터링 결과가 없어 모든 데이터 표시");
        setShipments(data);
        return;
      }
      
      // 모든 항목의 체크박스 해제 (selected: false로 설정)
      filteredData = filteredData.map(item => ({
        ...item,
        selected: false
      }));
      
      // 일시 필드 기준으로 내림차순 정렬 (최신순)
      filteredData = sortByDate(filteredData);
      
      // 필터링된 데이터 설정
      setShipments(filteredData);
      setCurrentPage(1); // 필터 적용 시 첫 페이지로 이동
      
    } catch (error) {
      console.error('자동 필터 적용 오류:', error);
      // 오류 발생시 원본 데이터 표시
      setShipments(data);
    }
  };

  return (
    <div className="dashboard" style={{ minHeight: "95vh" }}>
      {/* 구글 시트 URL 입력 */}
      <Card className="mb-2">
        <Card.Body className="p-2 d-flex align-items-center justify-content-between" style={{ backgroundColor: '#f0f8ff' }}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="구글 시트 주소 입력"
              value={googleSheetUrl}
              onChange={handleGoogleSheetUrlChange}
              className="border-secondary"
              disabled={!hasEditPermission()}
            />
            <Button 
              variant="primary" 
              onClick={loadDataFromGoogleSheet} 
              className="d-flex align-items-center"
              disabled={!hasEditPermission()}
            >
              <FaSync className="me-1" /> 불러오기
            </Button>
          </InputGroup>
          <div className="d-flex">
            <Button variant="outline-secondary" size="sm" className="me-1">
              <FaFileExport className="me-1" /> 엑셀 다운로드
            </Button>
            <Button variant="outline-primary" size="sm">
              스프레드시트 연동
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* 필터 영역 - 이미지 스타일에 맞게 한 줄로 재구성 */}
      <Card className="mb-2">
        <Card.Body className="p-2" style={{ backgroundColor: '#f0f8ff' }}>
          <Form onSubmit={handleSearch}>
            <Row className="g-2 align-items-center">
              {/* 기간 선택 */}
              <Col md={3} className="pe-0 d-flex align-items-center">
                <Form.Check 
                  type="checkbox"
                  id="filter-date"
                  className="me-1"
                  checked={true}
                  readOnly
                  style={{
                    '--bs-form-check-bg': '#fff',
                    '--bs-form-check-border-color': '#dc3545',
                    '--bs-form-check-checked-bg': '#dc3545',
                    '--bs-form-check-checked-border-color': '#dc3545'
                  }}
                />
                <Form.Label className="me-1 mb-0" style={{whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: 'bold', color: '#495057'}}>기간:</Form.Label>
                <Form.Control
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterValueChange}
                  size="sm"
                  className="me-1 border-secondary"
                  style={{width: '120px'}}
                />
                <span className="me-1" style={{fontSize: '0.9rem', color: '#495057'}}>~</span>
                <Form.Control
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterValueChange}
                  size="sm"
                  className="border-secondary"
                  style={{width: '120px'}}
                />
              </Col>
              
              {/* 원청 필터 */}
              <Col md={1} className="pe-0">
                <InputGroup size="sm">
                  <InputGroup.Checkbox 
                    id="filter-contractor" 
                    checked={filters.contractor}
                    onChange={handleFilterCheckChange}
                    className="bg-light"
                    style={{
                      '--bs-form-check-bg': '#fff',
                      '--bs-form-check-border-color': '#dc3545',
                      '--bs-form-check-checked-bg': '#dc3545',
                      '--bs-form-check-checked-border-color': '#dc3545'
                    }}
                  />
                  <Form.Control
                    placeholder="원청"
                    name="contractorValue"
                    value={filters.contractorValue}
                    onChange={handleFilterValueChange}
                    disabled={!filters.contractor}
                    style={{fontSize: '0.9rem'}}
                    className="border-secondary"
                  />
                </InputGroup>
              </Col>

              {/* 차량번호 필터 */}
              <Col md={1} className="pe-0">
                <InputGroup size="sm">
                  <InputGroup.Checkbox 
                    id="filter-vehicleNumber" 
                    checked={filters.vehicleNumber}
                    onChange={handleFilterCheckChange}
                    className="bg-light"
                    style={{
                      '--bs-form-check-bg': '#fff',
                      '--bs-form-check-border-color': '#dc3545',
                      '--bs-form-check-checked-bg': '#dc3545',
                      '--bs-form-check-checked-border-color': '#dc3545'
                    }}
                  />
                  <Form.Control
                    placeholder="차량번호"
                    name="vehicleNumberValue"
                    value={filters.vehicleNumberValue}
                    onChange={handleFilterValueChange}
                    disabled={!filters.vehicleNumber}
                    style={{fontSize: '0.9rem'}}
                    className="border-secondary"
                  />
                </InputGroup>
              </Col>

              {/* 기사명 필터 */}
              <Col md={1} className="pe-0">
                <InputGroup size="sm">
                  <InputGroup.Checkbox 
                    id="filter-driverName" 
                    checked={filters.driverName}
                    onChange={handleFilterCheckChange}
                    className="bg-light"
                    style={{
                      '--bs-form-check-bg': '#fff',
                      '--bs-form-check-border-color': '#dc3545',
                      '--bs-form-check-checked-bg': '#dc3545',
                      '--bs-form-check-checked-border-color': '#dc3545'
                    }}
                  />
                  <Form.Control
                    placeholder="기사명"
                    name="driverNameValue"
                    value={filters.driverNameValue}
                    onChange={handleFilterValueChange}
                    disabled={!filters.driverName}
                    style={{fontSize: '0.9rem'}}
                    className="border-secondary"
                  />
                </InputGroup>
              </Col>

              {/* 상차지 필터 */}
              <Col md={1} className="pe-0">
                <InputGroup size="sm">
                  <InputGroup.Checkbox 
                    id="filter-sender" 
                    checked={filters.sender}
                    onChange={handleFilterCheckChange}
                    className="bg-light"
                    style={{
                      '--bs-form-check-bg': '#fff',
                      '--bs-form-check-border-color': '#dc3545',
                      '--bs-form-check-checked-bg': '#dc3545',
                      '--bs-form-check-checked-border-color': '#dc3545'
                    }}
                  />
                  <Form.Control
                    placeholder="상차지"
                    name="senderValue"
                    value={filters.senderValue}
                    onChange={handleFilterValueChange}
                    disabled={!filters.sender}
                    style={{fontSize: '0.9rem'}}
                    className="border-secondary"
                  />
                </InputGroup>
              </Col>

              {/* 하차지 필터 */}
              <Col md={1} className="pe-0">
                <InputGroup size="sm">
                  <InputGroup.Checkbox 
                    id="filter-receiver" 
                    checked={filters.receiver}
                    onChange={handleFilterCheckChange}
                    className="bg-light"
                    style={{
                      '--bs-form-check-bg': '#fff',
                      '--bs-form-check-border-color': '#dc3545',
                      '--bs-form-check-checked-bg': '#dc3545',
                      '--bs-form-check-checked-border-color': '#dc3545'
                    }}
                  />
                  <Form.Control
                    placeholder="하차지"
                    name="receiverValue"
                    value={filters.receiverValue}
                    onChange={handleFilterValueChange}
                    disabled={!filters.receiver}
                    style={{fontSize: '0.9rem'}}
                    className="border-secondary"
                  />
                </InputGroup>
              </Col>

              {/* 조회 버튼 */}
              <Col md={1}>
                <Button 
                  variant="primary" 
                  type="submit" 
                  size="sm" 
                  className="w-100 d-flex align-items-center justify-content-center" 
                  style={{fontSize: '0.9rem', padding: '0.4rem', height: '31px'}}
                >
                  <FaSearch className="me-1" /> 조회
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>
      
      {/* 일괄 수정 영역 - 새로운 버튼 추가 */}
      <Card className="mb-2">
        <Card.Body className="p-2" style={{ backgroundColor: '#f7f9fa' }}>
          <Row className="align-items-center">
            <Col xs={7} className="d-flex">
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="me-1" 
                style={{fontSize: '1.2rem'}}
                onClick={handleOpenColumnEditModal}
              >
                <i className="fa fa-table me-1"></i> 컬럼 편집
              </Button>
              {hasEditPermission() && (
                <Button variant="outline-danger" size="sm" className="me-1" onClick={deleteSelectedItems} style={{fontSize: '1.2rem'}}>
                  <i className="fa fa-trash me-1"></i> 선택 항목 삭제
                </Button>
              )}
            </Col>
            <Col xs={5} className="text-end d-flex justify-content-end align-items-center">
              <InputGroup size="sm" style={{maxWidth: '180px'}} className="me-2">
                <InputGroup.Text className="bg-light" style={{fontSize: '0.8rem', padding: '0 0.5rem'}}>항목선택</InputGroup.Text>
                <Form.Select 
                  name="field"
                  value={bulkEdit.field}
                  onChange={handleBulkEditChange}
                  size="sm"
                  style={{fontSize: '0.8rem'}}
                  disabled={!hasEditPermission()}
                >
                  <option value="">선택하세요</option>
                  {getEditableFields().map(field => (
                    <option key={field.value} value={field.value}>{field.label}</option>
                  ))}
                </Form.Select>
              </InputGroup>
              <InputGroup size="sm" style={{maxWidth: '180px'}} className="me-2">
                <InputGroup.Text className="bg-light" style={{fontSize: '0.8rem', padding: '0 0.5rem'}}>새로운 값</InputGroup.Text>
                <Form.Control
                  name="value"
                  value={bulkEdit.value}
                  onChange={handleBulkEditChange}
                  size="sm"
                  style={{fontSize: '0.8rem'}}
                  disabled={!hasEditPermission()}
                />
              </InputGroup>
              <Button 
                variant="warning" 
                size="sm" 
                className="px-3" 
                onClick={applyBulkEdit}
                disabled={!hasEditPermission()}
              >
                <FaEdit className="me-1" /> 일괄 수정
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
            
      {/* 합계 계산 카드 */}
      <Card className="mb-2">
        <Card.Body className="p-1" style={{ backgroundColor: '#f0fff0' }}>
          <div className="table-responsive" style={{ maxHeight: "30vh", overflowY: "auto" }}>
            <Table bordered hover className="mb-0" size="sm" style={{ position: "relative" }}>
              <thead>
                <tr className="bg-light text-center" style={{position: 'sticky', top: 0, zIndex: 10}}>
                  {tableColumns.filter(column => column.visible).map((column) => (
                    <th 
                      key={column.id} 
                      className="text-center" 
                      style={{ 
                        minWidth: column.id === 'check' ? '40px' : 
                                  column.id === 'action' ? '130px' :
                                  ['기사명', '원청', '차량번호', '배차경로', '상차지', '하차지', 'sheetName'].includes(column.id) ? '120px' :
                                  ['매출', '매입', '분류코드', '일시', '소속', '연락처', '운송종류', '경유', '상차시간', '톤수', '비고', '거리'].includes(column.id) ? '80px' : '70px',
                        maxWidth: column.id === 'check' ? '40px' : 
                                  column.id === 'action' ? '130px' : '200px',
                        position: 'sticky',
                        top: 0,
                        backgroundColor: '#f8f9fa',
                        zIndex: 10,
                        fontSize: '0.85rem',
                        cursor: (column.id === '청구계' || column.id === '지급계') ? 'pointer' : 'default',
                        borderBottom: '1px solid #dee2e6',
                        boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)',
                        padding: '0.4rem 0.1rem'
                      }}
                      onClick={() => {
                        if (column.id === '청구계') calculateBillingTotal();
                        else if (column.id === '지급계') calculatePaymentTotal();
                      }}
                    >
                      {column.type === 'checkbox' ? (
                        <Form.Check 
                          type="checkbox"
                          onChange={handleSelectAllChange}
                          style={{
                            '--bs-form-check-bg': '#fff',
                            '--bs-form-check-border-color': '#dc3545',
                            '--bs-form-check-checked-bg': '#dc3545',
                            '--bs-form-check-checked-border-color': '#dc3545'
                          }}
                        />
                      ) : (
                        column.id === '청구계' ? 
                        <div title="클릭하여 청구계 자동 계산">{column.label}</div> : 
                        column.id === '지급계' ?
                        <div title="클릭하여 지급계 자동 계산">{column.label}</div> :
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{
                  backgroundColor: '#e6ffec', 
                  fontWeight: 'bold',
                  position: 'sticky',
                  top: '38px', /* 헤더 높이에 맞게 조정 */
                  zIndex: 9,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  lineHeight: '1.2'
                }}>
                  <td className="text-center p-1">
                    <div>합계</div>
                  </td>
                  {tableColumns.filter(col => col.visible && col.id !== 'check' && col.id !== 'action').map(column => (
                    <td key={column.id} className="text-center" style={{
                      fontSize: '0.85rem', 
                      padding: '0.3rem 0.1rem',
                      backgroundColor: column.id === '지급계' ? '#e6ffec' : 'inherit'
                    }}>
                      {['청구운임', '유류비1', '톨비2', '청구추가', '청구계', '지급운임', '지급추가1', '지급추가2', '지급계', '수수료', '위탁수수료', '수익', '실공급액', '부가세'].includes(column.id) ? 
                        shipments.reduce((sum, item) => sum + (Number(item[column.id]) || 0), 0).toLocaleString() + '원' : 
                        '-'}
                      {column.id === '지급계' && (
                        <span style={{
                          position: 'absolute', 
                          top: '2px', 
                          right: '2px', 
                          fontSize: '0.65rem',
                          color: '#008000'
                        }}>
                          <FaMoneyBillWave title="합계" />
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="text-center">
                    <div>-</div>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* 데이터 테이블 영역 - 별도 카드로 분리 */}
      <Card className="mb-2">
        <Card.Body className="p-1">
          <div className="table-responsive" style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Table bordered hover className="mb-0" size="sm" style={{ position: "relative" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 3 }}>
                <tr className="bg-light text-center" style={{ position: "sticky", top: 0, zIndex: 3 }}>
                  {tableColumns.filter(column => column.visible).map((column) => (
                    <th 
                      key={column.id} 
                      className="text-center" 
                      style={{ 
                        minWidth: column.id === 'check' ? '40px' : 
                                  column.id === 'action' ? '130px' :
                                  ['기사명', '원청', '차량번호', '배차경로', '상차지', '하차지', 'sheetName'].includes(column.id) ? '120px' :
                                  ['매출', '매입', '분류코드', '일시', '소속', '연락처', '운송종류', '경유', '상차시간', '톤수', '비고', '거리'].includes(column.id) ? '80px' : '70px',
                        maxWidth: column.id === 'check' ? '40px' : 
                                  column.id === 'action' ? '130px' : '200px',
                        position: 'sticky',
                        top: 0,
                        backgroundColor: '#f8f9fa',
                        zIndex: 3,
                        fontSize: '0.85rem',
                        cursor: (column.id === '청구계' || column.id === '지급계') ? 'pointer' : 'default',
                        borderBottom: '1px solid #dee2e6',
                        boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)',
                        padding: '0.4rem 0.1rem'
                      }}
                      onClick={() => {
                        if (column.id === '청구계') calculateBillingTotal();
                        else if (column.id === '지급계') calculatePaymentTotal();
                      }}
                    >
                      {column.type === 'checkbox' ? (
                        <Form.Check 
                          type="checkbox"
                          onChange={handleSelectAllChange}
                          style={{
                            '--bs-form-check-bg': '#fff',
                            '--bs-form-check-border-color': '#dc3545',
                            '--bs-form-check-checked-bg': '#dc3545',
                            '--bs-form-check-checked-border-color': '#dc3545'
                          }}
                        />
                      ) : (
                        column.id === '청구계' ? 
                        <div title="클릭하여 청구계 자동 계산">{column.label}</div> : 
                        column.id === '지급계' ?
                        <div title="클릭하여 지급계 자동 계산">{column.label}</div> :
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && getCurrentPageData().length > 0 && getCurrentPageData().map((shipment) => (
                  <tr 
                    key={shipment.id} 
                    style={{
                      backgroundColor: shipment.isInvoiceLocked ? '#ffeeee' : 'inherit',
                      lineHeight: '1.2'
                    }}
                  >
                    <td className="text-center p-1">
                      <Form.Check 
                        type="checkbox" 
                        checked={shipment.selected || false} 
                        onChange={() => handleCheckboxChange(shipment.id)}
                        style={{
                          '--bs-form-check-bg': '#fff',
                          '--bs-form-check-border-color': '#dc3545',
                          '--bs-form-check-checked-bg': '#dc3545',
                          '--bs-form-check-checked-border-color': '#dc3545'
                        }}
                      />
                    </td>
                    {/* 데이터 표시 - 보이는 컬럼에 대해서만 */}
                    {tableColumns.filter(col => col.visible && col.id !== 'check' && col.id !== 'action').map(column => (
                      <td 
                        key={column.id} 
                        className="text-center" 
                        style={{
                          fontSize: '0.85rem',
                          backgroundColor: shipment.autoCalculatedFields && shipment.autoCalculatedFields.includes(column.id) ? 
                            column.id === '지급계' ? '#e6ffec' : // 지급계는 연한 녹색
                            '#ffffd6' // 청구계 등 다른 자동 계산 필드는 노란색
                          : 'inherit',
                          position: 'relative',
                          padding: '0.3rem 0.1rem'
                        }}
                      >
                        {/* 운임 관련 필드 천단위 콤마 표시 */}
                        {['청구운임', '유류비1', '톨비2', '청구추가', '청구계', '지급운임', '지급추가1', '지급추가2', '지급계', '수수료', '위탁수수료', '수익', '실공급액', '부가세'].includes(column.id) 
                          ? (Number(shipment[column.id]) || 0).toLocaleString() 
                          : shipment[column.id] || '-'}
                        {shipment.autoCalculatedFields && shipment.autoCalculatedFields.includes(column.id) && (
                          <span 
                            style={{ 
                              position: 'absolute', 
                              top: '2px', 
                              right: '2px', 
                              fontSize: '0.65rem',
                              color: column.id === '지급계' ? '#008000' : '#ff6b00' // 지급계는 녹색 아이콘, 나머지는 주황색
                            }}
                          >
                            {column.id === '지급계' ? <FaMoneyBillWave title="자동 계산됨" /> : <FaLayerGroup title="자동 계산됨" />}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="text-center">
                      <div className="btn-group btn-group-sm">
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                          <>
                            <Button 
                              variant="warning" 
                              size="sm" 
                              className="text-dark py-0"
                              onClick={() => handleOpenEditModal(shipment)}
                            >
                              <FaEdit className="me-1" /> 수정
                            </Button>
                            <Button 
                              variant={shipment.isInvoiceLocked ? "secondary" : "success"}
                              size="sm" 
                              className="py-0 text-white"
                              onClick={() => handleInvoiceClick(shipment)}
                            >
                              {shipment.isInvoiceLocked ? <FaLock className="me-1" /> : <FaFileInvoice className="me-1" />} 계산서
                            </Button>
                            <Button
                              variant="info"
                              size="sm"
                              className="py-0 text-white"
                              onClick={() => handleOpenLogModal(shipment)}
                              disabled={!shipment.logs || shipment.logs.length === 0}
                            >
                              <FaHistory className="me-1" /> 로그
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-3" style={{fontSize: '0.85rem'}}>데이터를 불러오는 중...</td>
                  </tr>
                )}
                {!loading && getCurrentPageData().length === 0 && (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-3" style={{fontSize: '0.85rem'}}>데이터가 없습니다</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
        
      {/* 계산서 처리 모달 */}
      <Modal show={invoiceModal.show} onHide={handleInvoiceModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            {invoiceModal.mode === 'create' ? '계산서 처리' : '계산서 잠금 해제'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {invoiceModal.mode === 'create' ? (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>계산서를 처리하시겠습니까?</Form.Label>
                <Form.Control
                  as="textarea"
                  name="memo"
                  value={invoiceModal.memo}
                  onChange={handleInvoiceModalChange}
                  placeholder="메모를 입력하세요"
                  rows={4}
                />
                <Form.Text className="text-muted">
                  처리 후에는 비밀번호(0000)가 필요한 잠김 상태가 됩니다.
                </Form.Text>
              </Form.Group>
            </Form>
          ) : (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>저장된 메모</Form.Label>
                <Form.Control
                  as="textarea"
                  value={invoiceModal.savedMemo}
                  readOnly
                  rows={4}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>비밀번호 입력</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={invoiceModal.password}
                  onChange={handleInvoiceModalChange}
                  placeholder="비밀번호를 입력하세요"
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleInvoiceModalClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleInvoiceSave}>
            {invoiceModal.mode === 'create' ? '처리 완료' : '잠금 해제'}
          </Button>
        </Modal.Footer>
      </Modal>
        
      {/* 페이지네이션 영역 */}
      <div className="table-footer d-flex justify-content-start align-items-center mt-2">
        <span className="table-info-text me-2" style={{fontSize: '0.9rem', fontWeight: 'bold'}}>총 {shipments.length}건</span>
        <Form.Select 
          size="sm" 
          style={{width: '100px', display: 'inline-block', fontSize: '0.9rem'}}
          value={pageSize}
          onChange={handlePageSizeChange}
          className="me-3"
        >
          <option value="10">10개씩</option>
          <option value="20">20개씩</option>
          <option value="30">30개씩</option>
          <option value="50">50개씩</option>
          <option value="100">100개씩</option>
          <option value="200">200개씩</option>
          <option value="500">500개씩</option>
          <option value="1000">1000개씩</option>
        </Form.Select>
        <div>
          {renderPaginationNumbers()}
        </div>
      </div>

      {/* 수정 모달 */}
      <Modal show={editModal.show} onHide={handleCloseEditModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>데이터 수정</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editModal.shipment && (
            <Row className="mx-0">
              {tableColumns
                .slice(1, -1)
                .filter(col => col.id !== '청구계' && col.id !== '지급계') // 청구계와 지급계 제외
                .map((column, index) => (
                  <Col md={4} key={column.id} className="mb-3">
                    <Form.Group>
                      <Form.Label 
                        style={{
                          backgroundColor: '#f8f9fa',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'block',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          color: '#495057',
                          marginBottom: '5px'
                        }}
                      >
                        {column.label}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name={column.id}
                        value={editModal.editData[column.id] || ''}
                        onChange={handleEditModalChange}
                        className="border-secondary"
                      />
                    </Form.Group>
                  </Col>
                ))}
                
              {/* 청구계와 지급계 필드 추가 - 노란색 배경으로 표시 */}
              {['청구계', '지급계'].map(field => {
                const isAutoCalculated = editModal.editData.autoCalculatedFields && 
                                         editModal.editData.autoCalculatedFields.includes(field);
                const column = tableColumns.find(col => col.id === field);
                if (!column) return null;
                
                return (
                  <Col md={4} key={field} className="mb-3">
                    <Form.Group>
                      <Form.Label 
                        style={{
                          backgroundColor: '#f8f9fa',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          color: '#495057',
                          marginBottom: '5px'
                        }}
                      >
                        {column.label}
                        {isAutoCalculated && (
                          <span title="자동 계산됨" style={{color: field === '지급계' ? '#008000' : '#ff6b00'}}>
                            {field === '지급계' ? <FaMoneyBillWave /> : <FaLayerGroup />}
                          </span>
                        )}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name={field}
                        value={editModal.editData[field] || ''}
                        onChange={handleEditModalChange}
                        className="border-secondary"
                        style={{
                          backgroundColor: isAutoCalculated ? 
                            field === '지급계' ? '#e6ffec' : '#ffffd6' 
                            : 'inherit'
                        }}
                        readOnly={isAutoCalculated}
                      />
                    </Form.Group>
                  </Col>
                );
              })}
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEditModal}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* 로그 기록 모달 */}
      <Modal show={logModal.show} onHide={handleCloseLogModal}>
        <Modal.Header closeButton>
          <Modal.Title>수정 로그 기록</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {logModal.logs.length === 0 ? (
            <p className="text-center">로그 기록이 없습니다.</p>
          ) : (
            <ListGroup>
              {logModal.logs.map((log, index) => (
                <ListGroup.Item key={index} className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <strong>수정자:</strong> {log.editorName} 
                      <Badge bg="secondary" className="ms-2">{log.editorRole}</Badge>
                      {log.isAutoCalculated && <Badge bg="warning" text="dark" className="ms-2">자동 계산</Badge>}
                    </div>
                    <small className="text-muted">
                      {new Date(log.timestamp).toLocaleString()}
                    </small>
                  </div>
                  <div>
                    <strong>변경 항목:</strong> {log.changedFields.join(', ')}
                  </div>
                  <div className="mt-2">
                    <Table bordered size="sm">
                      <thead>
                        <tr>
                          <th>항목</th>
                          <th>이전 값</th>
                          <th>변경 값</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.changedFields.map(field => (
                          <tr key={field}>
                            <td>{field}</td>
                            <td>{log.oldValues[field] || '-'}</td>
                            <td>{log.newValues[field] || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseLogModal}>
            닫기
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 컬럼 편집 모달 */}
      <Modal show={columnEditModal.show} onHide={handleCloseColumnEditModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>컬럼 표시 설정</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">표시하거나 숨길 항목을 선택하세요.</p>
          <Row>
            {columnEditModal.columns
              .filter(col => col.id !== 'check' && col.id !== 'action') // 체크박스와 관리 컬럼은 항상 표시되므로 제외
              .map((column, index) => (
                <Col md={4} key={column.id} className="mb-2">
                  <Form.Check
                    type="switch"
                    id={`column-${column.id}`}
                    label={column.label}
                    checked={column.visible}
                    onChange={() => handleColumnVisibilityChange(column.id)}
                  />
                </Col>
              ))}
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseColumnEditModal}>
            취소
          </Button>
          <Button variant="warning" onClick={handleResetColumnSettings}>
            초기화
          </Button>
          <Button variant="primary" onClick={handleSaveColumnSettings}>
            저장
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Dashboard; 