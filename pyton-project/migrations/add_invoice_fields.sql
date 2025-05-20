-- 계산서 관련 필드 추가
ALTER TABLE shipments_data ADD COLUMN isInvoiceLocked BOOLEAN DEFAULT NULL;
ALTER TABLE shipments_data ADD COLUMN invoiceMemo TEXT DEFAULT NULL;
ALTER TABLE shipments_data ADD COLUMN invoicePassword VARCHAR(100) DEFAULT NULL;

-- 인덱스 추가 (선택 사항)
CREATE INDEX idx_invoice_locked ON shipments_data(isInvoiceLocked); 