// src/mixins/optionsMixin.js
export default {
    methods: {
        /**
         * สร้าง options ที่มี label / value ตามภาษาปัจจุบัน
         * ใช้สำหรับ dropdown เช่น organization, agencies, department
         */
        buildOptions(list = []) {
            const lang = this.lang || this.$store.getters['setting/lang']
            const base = []
            if (!Array.isArray(list)) return base

            const mapped = list.map(obj => {
                const title = obj.title?.find(t => t.key === lang)
                return {
                    label: title?.value || '-',
                    value: obj._id,
                }
            })

            return [...base, ...mapped]
        },

    },
}
