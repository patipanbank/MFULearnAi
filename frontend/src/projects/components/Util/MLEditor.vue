<template>
  <div>
    <CRow class="mb-2" >
      <CCol class="font-weight-bold">
        <label> {{caption}} </label>
      </CCol>
    </CRow>
    <CDropdownDivider/>
    <CRow class="mt-3" v-for="(objs , index) in items" :key="caption+index">
      <CCol col="3">
        <CInput prepend="Key" v-model="objs.key"></CInput>
      </CCol>
      <CCol >
        <QEditor :content="objs" />
      </CCol>
      <CCol v-if="disable" col="2" class="text-right ">
        <CButton @click="onAddRow"  size="sm" color="success" shape="pill" variant="outline" v-c-tooltip.hover.click="'Add'" >
          <CIcon name="cil-library-add"/>
        </CButton>
        <CButton @click="onRemove(objs)" class="ml-2" size="sm" color="danger" shape="pill" variant="outline" v-c-tooltip.hover.click="'Remove'">
          <CIcon name="cil-trash"/>
        </CButton>
      </CCol>
    </CRow>
  </div>
</template>

<script>

import Vue from 'vue'
import {mapGetters} from 'vuex'
import QEditor from "@/projects/components/Util/QEditor";

export default {
  name: 'MLEditor',
  components: {QEditor},
  props: {
    caption: {
      type: String,
      default: ' Campus '
    },
    items: {
      type: Array,
      default () {
        return [ {key:"th", value:""},{key:"en", value:""}  ]
      }
    },
    disable: {
      type: Boolean,
      default: true
    }
  },

  data: function () {
    return {
    }
  },

  mounted () {
  },

  created () {
    this.onInit()

  },
  beforeDestroy () {

  },

  methods: {
    onInit(){
    },

    onAddRow() {
      var objs = {};
      objs.key = "";
      objs.value = "";
      this.items.push(objs)
    },
    onRemove(item){
      this.items =  this.items.filter(objs => {
        return item.key != objs.key;
      });

      if(this.items.length == 0){
        var objs = {};
        objs.key = "th";
        objs.value = "";
        this.items.push(objs)
      }
    },

  },

  computed:{
    ...mapGetters({
    })
  },

  watch: {
  }

}
</script>
<style >


</style>
