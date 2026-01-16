// src/mixins/optionsMixin.js
export default {
    methods: {
        /**
         * สร้าง options ที่มี label / value ตามภาษาปัจจุบัน
         * ใช้สำหรับ dropdown เช่น organization, agencies, department
         */
        formatCurrency(value, currency = 'THB') {
            return new Intl.NumberFormat('th-TH', {
                style: 'currency',
                currency,
                minimumFractionDigits: 2
            }).format(value);
        },
    },
}
