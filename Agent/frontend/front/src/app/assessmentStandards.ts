// 根据后端 project_standards.json 生成的前端备用标准。
// 后端在线时以前端接口返回的当前项目标准为准；本文件仅用于初始展示和离线兜底。

export const TREATMENT_STANDARDS = [
  {
    "id": "yunan_town_plant_yn_plant_g01",
    "name": "郁南项目-镇街污水处理厂-有效运行时间",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g01_l2",
        "name": "有效运行时间",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_001",
            "name": "运行天数及停产",
            "maxScore": 15.0,
            "evaluationStandard": "停产天数每增加1天扣1分，因故停减产程序符合要求的天数不扣分",
            "standardText": "停产天数每增加1天扣1分，因故停减产程序符合要求的天数不扣分",
            "scoringMethod": "查阅记录",
            "dataSource": "污水处理厂运行天数符合主管部门要求并保持连续运行。",
            "options": [
              {
                "reason": "1. 停产天数每增加1天扣1分，因故停减产程序符合要求的天数不扣分",
                "type": "fixed",
                "value": 1.0,
                "unit": "天",
                "maxInstances": 15,
                "id": "yunan_town_plant_yn_plant_001_option_1",
                "name": "1. 停产天数每增加1天扣1分，因故停减产程序符合要求的天数不扣分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g02",
    "name": "郁南项目-镇街污水处理厂-处理质量",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g02_l2",
        "name": "处理质量",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_002",
            "name": "污水处理质量",
            "maxScore": 10.0,
            "evaluationStandard": "(1)化验报告显示当月有一项没做化验项目的，视为全月不合格。(2)如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格。(3)判定为不合格扣10分。",
            "standardText": "(1)化验报告显示当月有一项没做化验项目的，视为全月不合格。(2)如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格。(3)判定为不合格扣10分。",
            "scoringMethod": "查阅记录",
            "dataSource": "污水处理厂每月至少一次对出水COD、BOD5、SS、总磷、氨氮进行化验，并编制化验报告。",
            "options": [
              {
                "reason": "1. 化验报告显示当月有一项没做化验项目的，视为全月不合格",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_002_option_1",
                "name": "1. 化验报告显示当月有一项没做化验项目的，视为全月不合格",
                "deduction": 1.0
              },
              {
                "reason": "2. 如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_002_option_2",
                "name": "2. 如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格",
                "deduction": 1.0
              },
              {
                "reason": "3. 判定为不合格扣10分",
                "type": "fixed",
                "value": 10.0,
                "id": "yunan_town_plant_yn_plant_002_option_3",
                "name": "3. 判定为不合格扣10分",
                "deduction": 10.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_003",
            "name": "污泥处理质量",
            "maxScore": 5.0,
            "evaluationStandard": "污泥去向不明扣5分",
            "standardText": "污泥去向不明扣5分",
            "scoringMethod": "查阅记录",
            "dataSource": "污泥有妥善处理处置场所，无乱堆乱放。",
            "options": [
              {
                "reason": "1. 污泥去向不明扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_plant_yn_plant_003_option_1",
                "name": "1. 污泥去向不明扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g03",
    "name": "郁南项目-镇街污水处理厂-运营管理",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g03_l2",
        "name": "运营管理",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_004",
            "name": "操作规程",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣0.5分",
            "standardText": "缺少一项扣0.5分",
            "scoringMethod": "查阅记录",
            "dataSource": "操作规程齐，包括不限于管理制度、岗位操作规程及设施、设备维护手册，并定期修订。",
            "options": [
              {
                "reason": "1. 管理制度、岗位操作规程或设施设备维护手册每缺少一项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_plant_yn_plant_004_option_1",
                "name": "1. 管理制度、岗位操作规程或设施设备维护手册每缺少一项扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_005",
            "name": "生产运行记录",
            "maxScore": 6.0,
            "evaluationStandard": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "standardText": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录现场检查",
            "dataSource": "每月编制运行记录，如实反映全厂设备、设施、工艺及生产运行情况，包括：(1)化验结果报告；(2)各类设备、设施、仪表运行记录；(3)运行工艺控制参数记录；(4)污水厂加药和工艺参数及调整记录表，但材料消耗记录不全；(5)库存材料、设备、备件等库存记录。",
            "options": [
              {
                "reason": "1. 生产运行记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_005_option_1",
                "name": "1. 生产运行记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_006",
            "name": "维护、维修记录",
            "maxScore": 3.0,
            "evaluationStandard": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "standardText": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录现场检查",
            "dataSource": "建立电气、仪表、机械设备台帐，维护、维修记录包括：(1)电气、仪表、机械设备累计运行台时记录；(2)电气、仪表、机械设备维修及保养记录；(3)设备维护、维修记录。",
            "options": [
              {
                "reason": "1. 设备台账、累计运行台时、维修或保养记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_006_option_1",
                "name": "1. 设备台账、累计运行台时、维修或保养记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_007",
            "name": "工艺调控",
            "maxScore": 6.0,
            "evaluationStandard": "工段、设施、仪表有缺失或损坏的，每缺少1项扣2分；未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分。",
            "standardText": "工段、设施、仪表有缺失或损坏的，每缺少1项扣2分；未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分。",
            "scoringMethod": "现场检查",
            "dataSource": "各工段、设施、仪表等配置齐全、运行正常；按操作规程进行工艺监控和调整。",
            "options": [
              {
                "reason": "1. 工段、设施、仪表有缺失或损坏的，每缺少1项扣2分",
                "type": "fixed",
                "value": 2.0,
                "unit": "项",
                "maxInstances": 3,
                "id": "yunan_town_plant_yn_plant_007_option_1",
                "name": "1. 工段、设施、仪表有缺失或损坏的，每缺少1项扣2分",
                "deduction": 2.0
              },
              {
                "reason": "2. 未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "项",
                "maxInstances": 12,
                "id": "yunan_town_plant_yn_plant_007_option_2",
                "name": "2. 未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g04",
    "name": "郁南项目-镇街污水处理厂-构筑物及设备管理",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g04_l2",
        "name": "构筑物及设备管理",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_008",
            "name": "构筑物",
            "maxScore": 5.0,
            "evaluationStandard": "检查所有设施，发现一处腐蚀损坏扣0.5分",
            "standardText": "检查所有设施，发现一处腐蚀损坏扣0.5分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "污水厂(站)所有构筑物的结构及各种闸阀、护栏、爬梯、管道、井盖、盖板、支架、走道桥、照明设备和防雷电设施等无明显腐蚀损坏",
            "options": [
              {
                "reason": "1. 检查所有设施，发现一处腐蚀损坏扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 10,
                "id": "yunan_town_plant_yn_plant_008_option_1",
                "name": "1. 检查所有设施，发现一处腐蚀损坏扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_009",
            "name": "构筑物（观测构筑物运营情况）",
            "maxScore": 2.0,
            "evaluationStandard": "构筑物沉降扣1分，构筑物漏水扣1分",
            "standardText": "构筑物沉降扣1分，构筑物漏水扣1分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "观测构筑物运营情况，构筑物运行正常，不沉降，不漏水",
            "options": [
              {
                "reason": "1. 构筑物沉降扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_009_option_1",
                "name": "1. 构筑物沉降扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 构筑物漏水扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_009_option_2",
                "name": "2. 构筑物漏水扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_010",
            "name": "设备",
            "maxScore": 2.0,
            "evaluationStandard": "检查所有设备，发现一处缺失螺栓扣0.5分",
            "standardText": "检查所有设备，发现一处缺失螺栓扣0.5分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "所有设备外观整洁，螺栓齐全牢固",
            "options": [
              {
                "reason": "1. 检查所有设备，发现一处缺失螺栓扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_plant_yn_plant_010_option_1",
                "name": "1. 检查所有设备，发现一处缺失螺栓扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_011",
            "name": "设备（所有设备无腐蚀渗漏）",
            "maxScore": 2.0,
            "evaluationStandard": "检查所有设备，发现一处腐蚀渗漏扣0.5分",
            "standardText": "检查所有设备，发现一处腐蚀渗漏扣0.5分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "所有设备无腐蚀渗漏",
            "options": [
              {
                "reason": "1. 检查所有设备，发现一处腐蚀渗漏扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_plant_yn_plant_011_option_1",
                "name": "1. 检查所有设备，发现一处腐蚀渗漏扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_012",
            "name": "设备（所有设备台账齐全）",
            "maxScore": 1.0,
            "evaluationStandard": "无设备台账扣1分",
            "standardText": "无设备台账扣1分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "所有设备台账齐全",
            "options": [
              {
                "reason": "1. 无设备台账扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_012_option_1",
                "name": "1. 无设备台账扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_013",
            "name": "中控系统",
            "maxScore": 5.0,
            "evaluationStandard": "整县没有设置中控平台扣3分，子站无采集数据，无运行记录扣5分",
            "standardText": "整县没有设置中控平台扣3分，子站无采集数据，无运行记录扣5分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "整县有中控平台，镇区设有子站，污水处理设施生产运行情况有数据采集",
            "options": [
              {
                "reason": "1. 整县没有设置中控平台扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_plant_yn_plant_013_option_1",
                "name": "1. 整县没有设置中控平台扣3分",
                "deduction": 3.0
              },
              {
                "reason": "2. 无运行记录扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_plant_yn_plant_013_option_2",
                "name": "2. 无运行记录扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g05",
    "name": "郁南项目-镇街污水处理厂-安全生产",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g05_l2",
        "name": "安全生产",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_014",
            "name": "安全管理",
            "maxScore": 1.0,
            "evaluationStandard": "无安全规章制度扣1分，无安全检查记录扣0.5分，若无相关人员签名确认视为无效记录。",
            "standardText": "无安全规章制度扣1分，无安全检查记录扣0.5分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录",
            "dataSource": "建立安全规章制度，安全检查有记录。",
            "options": [
              {
                "reason": "1. 无安全规章制度扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_014_option_1",
                "name": "1. 无安全规章制度扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 无安全检查记录扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_plant_yn_plant_014_option_2",
                "name": "2. 无安全检查记录扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_015",
            "name": "安全管理（(1)岗位人员有必要的安全保护措施）",
            "maxScore": 4.0,
            "evaluationStandard": "有一项不达要求扣1分",
            "standardText": "有一项不达要求扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "(1)岗位人员有必要的安全保护措施；(2)有安全警示牌；(3)有毒有害场所有安全防护仪器和仪表；(4)危险品、易燃、易爆品按规管理。",
            "options": [
              {
                "reason": "1. 安全保护措施、安全警示牌、有毒有害场所防护仪器或危险品管理每有一项不达要求扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_015_option_1",
                "name": "1. 安全保护措施、安全警示牌、有毒有害场所防护仪器或危险品管理每有一项不达要求扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_016",
            "name": "安全生产责任书",
            "maxScore": 1.0,
            "evaluationStandard": "无逐级签订安全生产责任书，扣1分",
            "standardText": "无逐级签订安全生产责任书，扣1分",
            "scoringMethod": "查阅记录",
            "dataSource": "应逐级签订安全生产责任书",
            "options": [
              {
                "reason": "1. 无逐级签订安全生产责任书，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_016_option_1",
                "name": "1. 无逐级签订安全生产责任书，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_017",
            "name": "特种设备检定",
            "maxScore": 2.0,
            "evaluationStandard": "安全设施未按规定设置，每一处扣0.5分；电气设备和特种设备未取得相应的证书或检定报告书的，每一处扣1分。",
            "standardText": "安全设施未按规定设置，每一处扣0.5分；电气设备和特种设备未取得相应的证书或检定报告书的，每一处扣1分。",
            "scoringMethod": "现场检查",
            "dataSource": "安全设施应配置齐全、标志设置合理；变压器、高压电气设备、压力容器、起重设备及其它特种设备须经过相关管理部门检定并取得证书后方可投入使用。",
            "options": [
              {
                "reason": "1. 安全设施未按规定设置，每一处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_plant_yn_plant_017_option_1",
                "name": "1. 安全设施未按规定设置，每一处扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 电气设备和特种设备未取得相应的证书或检定报告书的，每一处扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "处",
                "maxInstances": 2,
                "id": "yunan_town_plant_yn_plant_017_option_2",
                "name": "2. 电气设备和特种设备未取得相应的证书或检定报告书的，每一处扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_018",
            "name": "应急预案",
            "maxScore": 3.0,
            "evaluationStandard": "缺少一项扣0.5分，一年内未组织演练扣1分",
            "standardText": "缺少一项扣0.5分，一年内未组织演练扣1分",
            "scoringMethod": "查阅记录",
            "dataSource": "建立事故应急体系，制定相应的安全生产、职业卫生、环境保护、自然灾害等应急预案。",
            "options": [
              {
                "reason": "1. 安全生产、职业卫生、环境保护或自然灾害应急预案每缺少一项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_plant_yn_plant_018_option_1",
                "name": "1. 安全生产、职业卫生、环境保护或自然灾害应急预案每缺少一项扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 一年内未组织演练扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_018_option_2",
                "name": "2. 一年内未组织演练扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_019",
            "name": "安全隐患",
            "maxScore": 3.0,
            "evaluationStandard": "厂内存在安全隐患的，扣1分，存在重大安全隐患的，扣3分。",
            "standardText": "厂内存在安全隐患的，扣1分，存在重大安全隐患的，扣3分。",
            "scoringMethod": "现场检查",
            "dataSource": "厂内不应存在安全隐患",
            "options": [
              {
                "reason": "1. 厂内存在一般安全隐患，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_019_option_1",
                "name": "1. 厂内存在一般安全隐患，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 厂内存在重大安全隐患，扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_plant_yn_plant_019_option_2",
                "name": "2. 厂内存在重大安全隐患，扣3分",
                "deduction": 3.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g06",
    "name": "郁南项目-镇街污水处理厂-人员情况",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g06_l2",
        "name": "人员情况",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_020",
            "name": "安全岗位持证上岗",
            "maxScore": 2.0,
            "evaluationStandard": "未持有有效的安全职业资格证书的，每一个岗位扣1分",
            "standardText": "未持有有效的安全职业资格证书的，每一个岗位扣1分",
            "scoringMethod": "现场查阅",
            "dataSource": "厂主管安全负责人、安全员应持有有效的安全职业资格证书",
            "options": [
              {
                "reason": "1. 未持有有效的安全职业资格证书的，每一个岗位扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_020_option_1",
                "name": "1. 未持有有效的安全职业资格证书的，每一个岗位扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_021",
            "name": "关键岗位持证上岗",
            "maxScore": 2.0,
            "evaluationStandard": "未持证上岗的，每缺少1人，扣1分",
            "standardText": "未持证上岗的，每缺少1人，扣1分",
            "scoringMethod": "现场查阅",
            "dataSource": "中控调度、污水处理、污泥处理、化验分析、变配电、机修等与生产直接相关的关键岗位应持有相应的职业资格证书或特种作业证书",
            "options": [
              {
                "reason": "1. 未持证上岗的，每缺少1人，扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "人",
                "maxInstances": 2,
                "id": "yunan_town_plant_yn_plant_021_option_1",
                "name": "1. 未持证上岗的，每缺少1人，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_022",
            "name": "运行管理架构",
            "maxScore": 1.0,
            "evaluationStandard": "运行管理机构未配置或不健全的，扣0.5分至1分。岗位职责未制定或不健全的，扣0.5分至1分。",
            "standardText": "运行管理机构未配置或不健全的，扣0.5分至1分。岗位职责未制定或不健全的，扣0.5分至1分。",
            "scoringMethod": "现场查阅",
            "dataSource": "应配置健全的运行管理架构，制定清晰、健全的岗位职责",
            "options": [
              {
                "reason": "1. 运行管理机构未配置或不健全的，扣0.5分至1分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_plant_yn_plant_022_option_1",
                "name": "1. 运行管理机构未配置或不健全的，扣0.5分至1分",
                "deduction": 0.5
              },
              {
                "reason": "2. 岗位职责未制定或不健全的，扣0.5分至1分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_plant_yn_plant_022_option_2",
                "name": "2. 岗位职责未制定或不健全的，扣0.5分至1分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g07",
    "name": "郁南项目-镇街污水处理厂-厂容厂貌",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g07_l2",
        "name": "厂容厂貌",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_023",
            "name": "厂(站)环境",
            "maxScore": 2.0,
            "evaluationStandard": "有杂物堆置扣2分",
            "standardText": "有杂物堆置扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "厂(站)无杂物堆置",
            "options": [
              {
                "reason": "1. 有杂物堆置扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_plant_yn_plant_023_option_1",
                "name": "1. 有杂物堆置扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_024",
            "name": "厂(站)环境（厂(站)环境整洁）",
            "maxScore": 4.0,
            "evaluationStandard": "周围有垃圾堆放扣2分；草皮缺失扣2分。",
            "standardText": "周围有垃圾堆放扣2分；草皮缺失扣2分。",
            "scoringMethod": "现场检查",
            "dataSource": "厂(站)环境整洁，绿化达标，植物有人打理",
            "options": [
              {
                "reason": "1. 周围有垃圾堆放扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_plant_yn_plant_024_option_1",
                "name": "1. 周围有垃圾堆放扣2分",
                "deduction": 2.0
              },
              {
                "reason": "2. 草皮缺失扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_plant_yn_plant_024_option_2",
                "name": "2. 草皮缺失扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_025",
            "name": "厂区噪音控制和臭味控制",
            "maxScore": 5.0,
            "evaluationStandard": "噪音控制超标扣3分，臭味控制超标扣3分。有投诉记录未处置，扣2分",
            "standardText": "噪音控制超标扣3分，臭味控制超标扣3分。有投诉记录未处置，扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "工业生产区噪音排放应小于65分贝；除臭设备运行稳定，能有效控制臭气排放",
            "options": [
              {
                "reason": "1. 噪音控制超标扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_plant_yn_plant_025_option_1",
                "name": "1. 噪音控制超标扣3分",
                "deduction": 3.0
              },
              {
                "reason": "2. 臭味控制超标扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_plant_yn_plant_025_option_2",
                "name": "2. 臭味控制超标扣3分",
                "deduction": 3.0
              },
              {
                "reason": "3. 有投诉记录未处置，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_plant_yn_plant_025_option_3",
                "name": "3. 有投诉记录未处置，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_plant_yn_plant_026",
            "name": "工作人员",
            "maxScore": 1.0,
            "evaluationStandard": "不能满足要求的，扣1分",
            "standardText": "不能满足要求的，扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "操作人员着装整齐，文明礼貌",
            "options": [
              {
                "reason": "1. 操作人员着装不整齐或不能做到文明礼貌，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_plant_yn_plant_026_option_1",
                "name": "1. 操作人员着装不整齐或不能做到文明礼貌，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_plant_yn_plant_g08",
    "name": "郁南项目-镇街污水处理厂-社会影响",
    "children": [
      {
        "id": "yunan_town_plant_yn_plant_g08_l2",
        "name": "社会影响",
        "items": [
          {
            "id": "yunan_town_plant_yn_plant_027",
            "name": "社会影响",
            "maxScore": 5.0,
            "evaluationStandard": "被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "standardText": "被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "scoringMethod": "查阅记录",
            "dataSource": "不被政府部门处罚、被社会有效投诉或公众媒体有效负面报道",
            "options": [
              {
                "reason": "1. 被政府部门处罚扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_plant_yn_plant_027_option_1",
                "name": "1. 被政府部门处罚扣5分",
                "deduction": 5.0
              },
              {
                "reason": "2. 被社会有效投诉每次扣2.5分",
                "type": "fixed",
                "value": 2.5,
                "unit": "次",
                "maxInstances": 2,
                "id": "yunan_town_plant_yn_plant_027_option_2",
                "name": "2. 被社会有效投诉每次扣2.5分",
                "deduction": 2.5
              },
              {
                "reason": "3. 被公众媒体有效负面报道扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_plant_yn_plant_027_option_3",
                "name": "3. 被公众媒体有效负面报道扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g01",
    "name": "郁南项目-农村污水处理设施-环境整治效果",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g01_l2",
        "name": "环境整治效果",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_001",
            "name": "服务范围",
            "maxScore": 10.0,
            "evaluationStandard": "设施半年累计负荷率70%以上不扣分；\n设施半年累计负荷率小于70%时：\n得分=10×（半年累计负荷/70%），其中设施半年累计负荷率=半年实际污水处理量/半年设计污水处理量",
            "standardText": "设施半年累计负荷率70%以上不扣分；\n设施半年累计负荷率小于70%时：\n得分=10×（半年累计负荷/70%），其中设施半年累计负荷率=半年实际污水处理量/半年设计污水处理量",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "农村排水采用雨污分流制，建立管网接户档案，污水处理设施服务区范围内不少于80%污水被收集处理。",
            "options": [
              {
                "reason": "1. 设施半年累计负荷率低于70%，按公式计算扣分：扣分=10-10×（半年累计负荷率/70%）",
                "type": "range",
                "min": 0,
                "max": 10.0,
                "id": "yunan_rural_treatment_yn_rural_001_option_1",
                "name": "1. 设施半年累计负荷率低于70%，按公式计算扣分：扣分=10-10×（半年累计负荷率/70%）",
                "value": 10.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_002",
            "name": "污水处理质量",
            "maxScore": 15.0,
            "evaluationStandard": "（1）CODCr不达标扣7分；\n（2）NH3-N或TP不达标每一项扣4分。",
            "standardText": "（1）CODCr不达标扣7分；\n（2）NH3-N或TP不达标每一项扣4分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期对处理设施进出水的CODCr、NH3-N、TP三项水质指标进行检测。分析进水水质是否符合设计要求，出水水质是否达到考核标准。",
            "options": [
              {
                "reason": "1. CODCr不达标扣7分",
                "type": "fixed",
                "value": 7.0,
                "id": "yunan_rural_treatment_yn_rural_002_option_1",
                "name": "1. CODCr不达标扣7分",
                "deduction": 7.0
              },
              {
                "reason": "2. NH3-N或TP不达标每一项扣4分",
                "type": "fixed",
                "value": 4.0,
                "unit": "项",
                "maxInstances": 3,
                "id": "yunan_rural_treatment_yn_rural_002_option_2",
                "name": "2. NH3-N或TP不达标每一项扣4分",
                "deduction": 4.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_003",
            "name": "整体效果",
            "maxScore": 15.0,
            "evaluationStandard": "村内污水排放状况、水环境未得到明显改善扣5~10分",
            "standardText": "村内污水排放状况、水环境未得到明显改善扣5~10分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "环境整治效果明显，工程实施能够进一步改善区域的水环境",
            "options": [
              {
                "reason": "1. 村内污水排放状况、水环境未得到明显改善扣5~10分",
                "type": "range",
                "min": 5.0,
                "max": 10.0,
                "id": "yunan_rural_treatment_yn_rural_003_option_1",
                "name": "1. 村内污水排放状况、水环境未得到明显改善扣5~10分",
                "value": 10.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g02",
    "name": "郁南项目-农村污水处理设施-污水收集管渠及附属设施",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g02_l2",
        "name": "污水收集管渠及附属设施",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_004",
            "name": "管道",
            "maxScore": 4.0,
            "evaluationStandard": "抽查5个井段。定期检查污水收集管道，清理淤积物；及时改造已损坏或已堵塞的管渠，保持过流通畅。",
            "standardText": "污水收集管道有堵塞，导致旱季检查井水位淹没排水管的，每一个扣0.4分；导致检查井内水深达到1.0米以上的，每一个扣0.8分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期检查污水收集管道，清理淤积物；及时改造已损坏或已堵塞的管渠，保持过流通畅。",
            "options": [
              {
                "reason": "1. 污水收集管道堵塞，导致旱季检查井水位淹没排水管，每个扣0.4分",
                "type": "fixed",
                "value": 0.4,
                "unit": "个",
                "maxInstances": 10,
                "id": "yunan_rural_treatment_yn_rural_004_option_1",
                "name": "1. 污水收集管道堵塞，导致旱季检查井水位淹没排水管，每个扣0.4分",
                "deduction": 0.4
              },
              {
                "reason": "2. 污水收集管道堵塞，导致检查井内水深达到1.0米以上，每个扣0.8分",
                "type": "fixed",
                "value": 0.8,
                "unit": "个",
                "maxInstances": 5,
                "id": "yunan_rural_treatment_yn_rural_004_option_2",
                "name": "2. 污水收集管道堵塞，导致检查井内水深达到1.0米以上，每个扣0.8分",
                "deduction": 0.8
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_005",
            "name": "检查井",
            "maxScore": 10.0,
            "evaluationStandard": "抽查5个井段。定期检查各类污水检查井，清理淤积物；及时更换或修复已损坏的井环盖或溢流管口，保证检查井完整、安全。",
            "standardText": "检查井内有明显沉泥、井身损坏（批荡脱落或开裂）、井深大于2.0米但未安装防护网等，每发现1个检查井出现前述问题之一，扣1分；井盖打不开、挤压、破损、井盖与地面高差大于5毫米等，每出现一项扣1分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期检查各类污水检查井，清理淤积物；及时更换或修复已损坏的井环盖或溢流管口，保证检查井的完整性和安全性",
            "options": [
              {
                "reason": "1. 检查井内有明显沉泥、井身损坏，或井深大于2.0米但未安装防护网，每个扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "个",
                "maxInstances": 10,
                "id": "yunan_rural_treatment_yn_rural_005_option_1",
                "name": "1. 检查井内有明显沉泥、井身损坏，或井深大于2.0米但未安装防护网，每个扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 井盖打不开、挤压、破损，或井盖与地面高差大于5毫米，每项扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "项",
                "maxInstances": 10,
                "id": "yunan_rural_treatment_yn_rural_005_option_2",
                "name": "2. 井盖打不开、挤压、破损，或井盖与地面高差大于5毫米，每项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g03",
    "name": "郁南项目-农村污水处理设施-污水预处理设施",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g03_l2",
        "name": "污水预处理设施",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_006",
            "name": "格栅",
            "maxScore": 2.0,
            "evaluationStandard": "格栅池未设置格栅、格栅失效（被淹没、安装方向错误)、栅距过大(超过25mm)、未清理垃圾的，发现一项扣1分，最多扣2分",
            "standardText": "格栅池未设置格栅、格栅失效（被淹没、安装方向错误)、栅距过大(超过25mm)、未清理垃圾的，发现一项扣1分，最多扣2分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期检查格栅池，清理垃圾，更换或改造已损坏或不规范的格栅，防止垃圾进入泵井和厌氧池，损坏设施。",
            "options": [
              {
                "reason": "1. 未设置格栅、格栅失效、安装方向错误、栅距超过25mm或未清理垃圾，每发现一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "项",
                "maxInstances": 2,
                "id": "yunan_rural_treatment_yn_rural_006_option_1",
                "name": "1. 未设置格栅、格栅失效、安装方向错误、栅距超过25mm或未清理垃圾，每发现一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_007",
            "name": "集水井",
            "maxScore": 2.0,
            "evaluationStandard": "井内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
            "standardText": "井内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期清理，防止泥沙淤积影响设施正常运作。",
            "options": [
              {
                "reason": "1. 井内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_rural_treatment_yn_rural_007_option_1",
                "name": "1. 井内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_008",
            "name": "厌氧水解池",
            "maxScore": 5.0,
            "evaluationStandard": "（1）池内有明显淤积、有垃圾或漂浮物未定期清理，扣2分；\n（2）未及时维修填料和框架、未按要求更换填料的，扣2分；\n（3）通风设施(通气口或检查口)失效的，扣1分。",
            "standardText": "（1）池内有明显淤积、有垃圾或漂浮物未定期清理，扣2分；\n（2）未及时维修填料和框架、未按要求更换填料的，扣2分；\n（3）通风设施(通气口或检查口)失效的，扣1分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "每年清理一次以上，防止污泥淤积；定期检查维修厌氧池填料。",
            "options": [
              {
                "reason": "1. 池内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_rural_treatment_yn_rural_008_option_1",
                "name": "1. 池内有明显淤积、有垃圾或漂浮物未定期清理，扣2分",
                "deduction": 2.0
              },
              {
                "reason": "2. 未及时维修填料和框架、未按要求更换填料的，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_rural_treatment_yn_rural_008_option_2",
                "name": "2. 未及时维修填料和框架、未按要求更换填料的，扣2分",
                "deduction": 2.0
              },
              {
                "reason": "3. 通风设施(通气口或检查口)失效的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_008_option_3",
                "name": "3. 通风设施(通气口或检查口)失效的，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g04",
    "name": "郁南项目-农村污水处理设施-设备配置",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g04_l2",
        "name": "设备配置",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_009",
            "name": "维护设备",
            "maxScore": 5.0,
            "evaluationStandard": "无配备扣5分",
            "standardText": "无配备扣5分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "全县至少配备一辆高压水冲车、一辆吸泥车等专用车辆",
            "options": [
              {
                "reason": "1. 未配备高压水冲车、吸泥车等规定的维护车辆，扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_009_option_1",
                "name": "1. 未配备高压水冲车、吸泥车等规定的维护车辆，扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_010",
            "name": "维护设备（维护作业队伍配备易燃、易爆、有毒气体监测装置、防）",
            "maxScore": 5.0,
            "evaluationStandard": "缺少一项扣1分",
            "standardText": "缺少一项扣1分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "维护作业队伍配备易燃、易爆、有毒气体监测装置、防毒面具",
            "options": [
              {
                "reason": "1. 易燃易爆或有毒气体监测装置、防毒面具每缺少一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_010_option_1",
                "name": "1. 易燃易爆或有毒气体监测装置、防毒面具每缺少一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g05",
    "name": "郁南项目-农村污水处理设施-设备运行和维护",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g05_l2",
        "name": "设备运行和维护",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_011",
            "name": "水泵、鼓风系统等机电设备",
            "maxScore": 5.0,
            "evaluationStandard": "（1）水泵、鼓风机及其附属设备缺失的，扣5分；\n（2）水泵、鼓风机运行异常；控制回路设置不合理的，扣5分。",
            "standardText": "（1）水泵、鼓风机及其附属设备缺失的，扣5分；\n（2）水泵、鼓风机运行异常；控制回路设置不合理的，扣5分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "定期检查、保养，运行和维护应严格按照厂家提供的操作规程执行，及时更换零配件等。",
            "options": [
              {
                "reason": "1. 水泵、鼓风机及其附属设备缺失的，扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_011_option_1",
                "name": "1. 水泵、鼓风机及其附属设备缺失的，扣5分",
                "deduction": 5.0
              },
              {
                "reason": "2. 水泵、鼓风机运行异常或控制回路设置不合理，扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_011_option_2",
                "name": "2. 水泵、鼓风机运行异常或控制回路设置不合理，扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g06",
    "name": "郁南项目-农村污水处理设施-安全管理",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g06_l2",
        "name": "安全管理",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_012",
            "name": "安全管理措施",
            "maxScore": 5.0,
            "evaluationStandard": "（1）现场未设置安全警示标志的，扣1分；\n（2）构筑物及附件有明显缺损、裂缝的；金属构件有明显锈蚀，影响安全使用的，扣2分；\n（3）必须敞露的设施未设置符合安全要求的格网、栏杆等的，扣1分；\n（4）供配电设施有缺损；机电设施配电不符合规范，影响安全用电的，扣1分。",
            "standardText": "（1）现场未设置安全警示标志的，扣1分；\n（2）构筑物及附件有明显缺损、裂缝的；金属构件有明显锈蚀，影响安全使用的，扣2分；\n（3）必须敞露的设施未设置符合安全要求的格网、栏杆等的，扣1分；\n（4）供配电设施有缺损；机电设施配电不符合规范，影响安全用电的，扣1分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "设施是否设置了相关的安全维护设施以及分隔维护措施。各种附件等要保持清洁完好。金属构件无明显锈蚀。",
            "options": [
              {
                "reason": "1. 现场未设置安全警示标志的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_012_option_1",
                "name": "1. 现场未设置安全警示标志的，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 构筑物及附件有明显缺损、裂缝，或金属构件明显锈蚀影响安全使用，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_rural_treatment_yn_rural_012_option_2",
                "name": "2. 构筑物及附件有明显缺损、裂缝，或金属构件明显锈蚀影响安全使用，扣2分",
                "deduction": 2.0
              },
              {
                "reason": "3. 必须敞露的设施未设置符合安全要求的格网、栏杆等，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_012_option_3",
                "name": "3. 必须敞露的设施未设置符合安全要求的格网、栏杆等，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "4. 供配电设施有缺损，或机电设施配电不符合规范并影响安全用电，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_012_option_4",
                "name": "4. 供配电设施有缺损，或机电设施配电不符合规范并影响安全用电，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g07",
    "name": "郁南项目-农村污水处理设施-资料管理",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g07_l2",
        "name": "资料管理",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_013",
            "name": "设施运行维护管理资料",
            "maxScore": 2.0,
            "evaluationStandard": "未提供设施日常巡查、定期检查记录；每出现一项扣1分，最多扣2分。",
            "standardText": "未提供设施日常巡查、定期检查记录；每出现一项扣1分，最多扣2分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "建立并落实日常巡查、定期检查和报告制度。",
            "options": [
              {
                "reason": "1. 未提供设施日常巡查记录或定期检查记录，每缺少一类记录扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_rural_treatment_yn_rural_013_option_1",
                "name": "1. 未提供设施日常巡查记录或定期检查记录，每缺少一类记录扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_rural_treatment_yn_rural_g08",
    "name": "郁南项目-农村污水处理设施-社会综合评价",
    "children": [
      {
        "id": "yunan_rural_treatment_yn_rural_g08_l2",
        "name": "社会综合评价",
        "items": [
          {
            "id": "yunan_rural_treatment_yn_rural_014",
            "name": "有效投诉",
            "maxScore": 5.0,
            "evaluationStandard": "被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "standardText": "被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "不被政府部门处罚、被社会有效投诉或公众媒体有效负面报道",
            "options": [
              {
                "reason": "1. 被政府部门处罚扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_014_option_1",
                "name": "1. 被政府部门处罚扣5分",
                "deduction": 5.0
              },
              {
                "reason": "2. 被社会有效投诉每次扣2.5分",
                "type": "fixed",
                "value": 2.5,
                "unit": "次",
                "maxInstances": 2,
                "id": "yunan_rural_treatment_yn_rural_014_option_2",
                "name": "2. 被社会有效投诉每次扣2.5分",
                "deduction": 2.5
              },
              {
                "reason": "3. 被公众媒体有效负面报道扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_014_option_3",
                "name": "3. 被公众媒体有效负面报道扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_015",
            "name": "公众调查",
            "maxScore": 5.0,
            "evaluationStandard": "一年无开展公众调查扣5分",
            "standardText": "一年无开展公众调查扣5分",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "项目公司一年内应开展农村污水处理设施公众调查，并编写调查报告，并按相关建议实施提升改善。",
            "options": [
              {
                "reason": "1. 一年无开展公众调查扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_rural_treatment_yn_rural_015_option_1",
                "name": "1. 一年无开展公众调查扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_rural_treatment_yn_rural_016",
            "name": "公众评价",
            "maxScore": 5.0,
            "evaluationStandard": "公众评价总体优良不扣分；\n公众评价总体一般扣1~3分；\n公众评价总体不合格扣3~5分。",
            "standardText": "公众评价总体优良不扣分；\n公众评价总体一般扣1~3分；\n公众评价总体不合格扣3~5分。",
            "scoringMethod": "按报告评分标准据实扣分",
            "dataSource": "政府方或其聘请第三方机构向公众实施调查，编写公众评分报告注：可参考表4设计公众调查表，A选项占所有选项80%或以上，则总体优良；A选项占所有选项60%或以上，则总体一般；A选项占所有选项60%以下，则总体不合格。",
            "options": [
              {
                "reason": "1. 公众评价总体一般扣1~3分",
                "type": "range",
                "min": 1.0,
                "max": 3.0,
                "id": "yunan_rural_treatment_yn_rural_016_option_1",
                "name": "1. 公众评价总体一般扣1~3分",
                "value": 3.0
              },
              {
                "reason": "2. 公众评价总体不合格扣3~5分",
                "type": "range",
                "min": 3.0,
                "max": 5.0,
                "id": "yunan_rural_treatment_yn_rural_016_option_2",
                "name": "2. 公众评价总体不合格扣3~5分",
                "value": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g01",
    "name": "茂南项目-镇街污水处理厂-有效运行时间",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g01_l2",
        "name": "有效运行时间",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_001",
            "name": "运行天数及停产",
            "maxScore": 15.0,
            "evaluationStandard": "停产天数每增加1天扣0.5分，因故停减产程序符合要求的天数不扣分。",
            "standardText": "停产天数每增加1天扣0.5分，因故停减产程序符合要求的天数不扣分。",
            "scoringMethod": "查阅记录",
            "dataSource": "水质净化厂运行天数符合主管部门要求并保持连续运行。",
            "options": [
              {
                "reason": "1. 停产天数每增加1天扣0.5分，因故停减产程序符合要求的天数不扣分",
                "type": "fixed",
                "value": 0.5,
                "unit": "天",
                "maxInstances": 30,
                "id": "maonan_town_plant_mn_plant_001_option_1",
                "name": "1. 停产天数每增加1天扣0.5分，因故停减产程序符合要求的天数不扣分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g02",
    "name": "茂南项目-镇街污水处理厂-处理质量",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g02_l2",
        "name": "处理质量",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_002",
            "name": "污水处理质量",
            "maxScore": 10.0,
            "evaluationStandard": "(1)化验报告显示当月有一项没做化验项目的，视为全月不合格。(2)如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格。(3)判定为不合格扣10分。",
            "standardText": "(1)化验报告显示当月有一项没做化验项目的，视为全月不合格。(2)如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格。(3)判定为不合格扣10分。",
            "scoringMethod": "查阅记录",
            "dataSource": "水质净化厂每月至少一次对出水COD、SS、总磷、氨氮进行化验，并编制化验报告。",
            "options": [
              {
                "reason": "1. 化验报告显示当月有一项没做化验项目的，视为全月不合格",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_002_option_1",
                "name": "1. 化验报告显示当月有一项没做化验项目的，视为全月不合格",
                "deduction": 1.0
              },
              {
                "reason": "2. 如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_002_option_2",
                "name": "2. 如果有环保部门或上级监管部门抽查判定为不合格的就视为全月不合格",
                "deduction": 1.0
              },
              {
                "reason": "3. 判定为不合格扣10分",
                "type": "fixed",
                "value": 10.0,
                "id": "maonan_town_plant_mn_plant_002_option_3",
                "name": "3. 判定为不合格扣10分",
                "deduction": 10.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_003",
            "name": "污泥处理质量",
            "maxScore": 5.0,
            "evaluationStandard": "污泥处置场所管理不规范或去向不明，扣2分。",
            "standardText": "污泥处置场所管理不规范或去向不明，扣2分。",
            "scoringMethod": "查阅记录",
            "dataSource": "污泥有妥善处理处置场所，无乱堆乱放，污泥处置去向明确。",
            "options": [
              {
                "reason": "1. 污泥处置场所管理不规范或去向不明，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_003_option_1",
                "name": "1. 污泥处置场所管理不规范或去向不明，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g03",
    "name": "茂南项目-镇街污水处理厂-运营管理",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g03_l2",
        "name": "运营管理",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_004",
            "name": "操作规程",
            "maxScore": 4.0,
            "evaluationStandard": "缺少一项扣0.5分",
            "standardText": "缺少一项扣0.5分",
            "scoringMethod": "查阅记录",
            "dataSource": "操作规程齐，包括不限于管理制度、岗位操作规程及设施、设备维护手册，并定期修订。",
            "options": [
              {
                "reason": "1. 管理制度、岗位操作规程或设施设备维护手册每缺少一项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_004_option_1",
                "name": "1. 管理制度、岗位操作规程或设施设备维护手册每缺少一项扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_005",
            "name": "生产运行记录",
            "maxScore": 6.0,
            "evaluationStandard": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "standardText": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录现场检查",
            "dataSource": "每月编制运行记录，如实反映全厂设备、设施、工艺及生产运行情况。",
            "options": [
              {
                "reason": "1. 生产运行记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_005_option_1",
                "name": "1. 生产运行记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_006",
            "name": "维护、维修记录",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "standardText": "缺少一项扣1分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录现场检查",
            "dataSource": "建立电气、仪表、机械设备台账，维护、维修记录。",
            "options": [
              {
                "reason": "1. 电气、仪表或机械设备台账、维护维修记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_006_option_1",
                "name": "1. 电气、仪表或机械设备台账、维护维修记录每缺少一类扣1分；无相关人员签名确认的记录按缺失处理",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_007",
            "name": "工艺调控",
            "maxScore": 5.0,
            "evaluationStandard": "工段、设施、仪表有缺失或损坏的，每缺少1项扣1分；未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分。",
            "standardText": "工段、设施、仪表有缺失或损坏的，每缺少1项扣1分；未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分。",
            "scoringMethod": "现场检查",
            "dataSource": "各工段、设施、仪表等配置齐全、运行正常；按操作规程进行工艺监控和调整。",
            "options": [
              {
                "reason": "1. 工段、设施、仪表有缺失或损坏的，每缺少1项扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "项",
                "maxInstances": 5,
                "id": "maonan_town_plant_mn_plant_007_option_1",
                "name": "1. 工段、设施、仪表有缺失或损坏的，每缺少1项扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "项",
                "maxInstances": 10,
                "id": "maonan_town_plant_mn_plant_007_option_2",
                "name": "2. 未按操作规程对工艺参数进行监控分析的，每缺少1项/次扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g04",
    "name": "茂南项目-镇街污水处理厂-构筑物及设备管理",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g04_l2",
        "name": "构筑物及设备管理",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_008",
            "name": "构筑物",
            "maxScore": 8.0,
            "evaluationStandard": "检查所有设施，发现1处明显腐蚀损坏扣0.1分",
            "standardText": "检查所有设施，发现1处明显腐蚀损坏扣0.1分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "污水厂(站)所有构筑物的结构及各种闸阀、护栏、爬梯、管道、井盖、盖板、支架、走道桥、照明设备和防雷电设施等无明显腐蚀损坏。",
            "options": [
              {
                "reason": "1. 检查所有设施，发现1处明显腐蚀损坏扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 79,
                "id": "maonan_town_plant_mn_plant_008_option_1",
                "name": "1. 检查所有设施，发现1处明显腐蚀损坏扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_009",
            "name": "构筑物（观测构筑物运营情况）",
            "maxScore": 6.0,
            "evaluationStandard": "构筑物每有一座沉降扣0.5分，构筑物每有一座漏水扣0.5分。",
            "standardText": "构筑物每有一座沉降扣0.5分，构筑物每有一座漏水扣0.5分。",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "观测构筑物运营情况，构筑物运行正常。",
            "options": [
              {
                "reason": "1. 构筑物每有一座沉降扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "座",
                "maxInstances": 12,
                "id": "maonan_town_plant_mn_plant_009_option_1",
                "name": "1. 构筑物每有一座沉降扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 构筑物每有一座漏水扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "座",
                "maxInstances": 12,
                "id": "maonan_town_plant_mn_plant_009_option_2",
                "name": "2. 构筑物每有一座漏水扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_010",
            "name": "构筑物（所有设备台账齐全）",
            "maxScore": 1.0,
            "evaluationStandard": "无设备台账扣1分",
            "standardText": "无设备台账扣1分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "所有设备台账齐全",
            "options": [
              {
                "reason": "1. 无设备台账扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_010_option_1",
                "name": "1. 无设备台账扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_011",
            "name": "中控系统",
            "maxScore": 3.0,
            "evaluationStandard": "没有设置全区中控平台扣2分，子站无采集数据，无运行记录扣1分",
            "standardText": "没有设置全区中控平台扣2分，子站无采集数据，无运行记录扣1分",
            "scoringMethod": "现场检查查阅记录",
            "dataSource": "全区有中控平台，镇区设有子站，污水处理设施生产运行情况有数据采集",
            "options": [
              {
                "reason": "1. 没有设置全区中控平台扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_011_option_1",
                "name": "1. 没有设置全区中控平台扣2分",
                "deduction": 2.0
              },
              {
                "reason": "2. 无运行记录扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_011_option_2",
                "name": "2. 无运行记录扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g05",
    "name": "茂南项目-镇街污水处理厂-安全生产",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g05_l2",
        "name": "安全生产",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_012",
            "name": "安全管理",
            "maxScore": 4.0,
            "evaluationStandard": "无安全规章制度扣2分，无安全检查记录扣2分，若无相关人员签名确认视为无效记录。",
            "standardText": "无安全规章制度扣2分，无安全检查记录扣2分，若无相关人员签名确认视为无效记录。",
            "scoringMethod": "查阅记录",
            "dataSource": "建立安全规章制度，安全检查有记录。",
            "options": [
              {
                "reason": "1. 无安全规章制度扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_012_option_1",
                "name": "1. 无安全规章制度扣2分",
                "deduction": 2.0
              },
              {
                "reason": "2. 无安全检查记录扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_012_option_2",
                "name": "2. 无安全检查记录扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_013",
            "name": "安全管理（(1)岗位人员有必要的安全保护措施）",
            "maxScore": 5.0,
            "evaluationStandard": "有一项不达要求扣0.5分",
            "standardText": "有一项不达要求扣0.5分",
            "scoringMethod": "现场检查",
            "dataSource": "(1)岗位人员有必要的安全保护措施；(2)有安全警示牌；(3)有毒有害场所有安全防护仪器和仪表；(4)危险品、易燃、易爆品按规管理。",
            "options": [
              {
                "reason": "1. 安全保护措施、安全警示牌、有毒有害场所防护仪器或危险品管理每有一项不达要求扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_013_option_1",
                "name": "1. 安全保护措施、安全警示牌、有毒有害场所防护仪器或危险品管理每有一项不达要求扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_014",
            "name": "安全生产责任书",
            "maxScore": 1.0,
            "evaluationStandard": "无逐级签订安全生产责任书，扣1分",
            "standardText": "无逐级签订安全生产责任书，扣1分",
            "scoringMethod": "查阅记录",
            "dataSource": "应逐级签订安全生产责任书",
            "options": [
              {
                "reason": "1. 无逐级签订安全生产责任书，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_014_option_1",
                "name": "1. 无逐级签订安全生产责任书，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_015",
            "name": "应急预案",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣1分，一年内未组织演练扣2分",
            "standardText": "缺少一项扣1分，一年内未组织演练扣2分",
            "scoringMethod": "查阅记录",
            "dataSource": "建立事故应急体系，制定相应的安全生产、职业卫生、环境保护、自然灾害等应急预案。",
            "options": [
              {
                "reason": "1. 安全生产、职业卫生、环境保护或自然灾害应急预案每缺少一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_015_option_1",
                "name": "1. 安全生产、职业卫生、环境保护或自然灾害应急预案每缺少一项扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 一年内未组织演练扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_015_option_2",
                "name": "2. 一年内未组织演练扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_016",
            "name": "安全隐患",
            "maxScore": 2.0,
            "evaluationStandard": "存在重大安全隐患的，扣2分。",
            "standardText": "存在重大安全隐患的，扣2分。",
            "scoringMethod": "现场检查",
            "dataSource": "厂内不应存在重大安全隐患",
            "options": [
              {
                "reason": "1. 存在重大安全隐患的，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_016_option_1",
                "name": "1. 存在重大安全隐患的，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g06",
    "name": "茂南项目-镇街污水处理厂-人员情况",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g06_l2",
        "name": "人员情况",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_017",
            "name": "安全岗位持证上岗",
            "maxScore": 1.0,
            "evaluationStandard": "未持有有效的安全职业资格证书的，每一个岗位扣0.5分",
            "standardText": "未持有有效的安全职业资格证书的，每一个岗位扣0.5分",
            "scoringMethod": "现场查阅",
            "dataSource": "厂主管安全负责人、安全员应持有有效的安全职业资格证书",
            "options": [
              {
                "reason": "1. 未持有有效的安全职业资格证书的，每一个岗位扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_017_option_1",
                "name": "1. 未持有有效的安全职业资格证书的，每一个岗位扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_018",
            "name": "关键岗位持证上岗",
            "maxScore": 2.0,
            "evaluationStandard": "未持证上岗的，每缺少1人，扣0.2分",
            "standardText": "未持证上岗的，每缺少1人，扣0.2分",
            "scoringMethod": "现场查阅",
            "dataSource": "与生产直接相关的关键岗位应持有相应的国家职业资格证书或特种作业证书",
            "options": [
              {
                "reason": "1. 未持证上岗的，每缺少1人，扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "unit": "人",
                "maxInstances": 9,
                "id": "maonan_town_plant_mn_plant_018_option_1",
                "name": "1. 未持证上岗的，每缺少1人，扣0.2分",
                "deduction": 0.2
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_019",
            "name": "运行管理架构",
            "maxScore": 3.0,
            "evaluationStandard": "运行管理机构未配置或不健全的，扣0.5分。岗位职责未制定或不健全的，扣0.5分。",
            "standardText": "运行管理机构未配置或不健全的，扣0.5分。岗位职责未制定或不健全的，扣0.5分。",
            "scoringMethod": "现场查阅",
            "dataSource": "应配置健全的运行管理架构，制定清晰、健全的岗位职责",
            "options": [
              {
                "reason": "1. 运行管理机构未配置或不健全的，扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_019_option_1",
                "name": "1. 运行管理机构未配置或不健全的，扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 岗位职责未制定或不健全的，扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_019_option_2",
                "name": "2. 岗位职责未制定或不健全的，扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g07",
    "name": "茂南项目-镇街污水处理厂-厂容厂貌",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g07_l2",
        "name": "厂容厂貌",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_020",
            "name": "厂(站)环境",
            "maxScore": 3.0,
            "evaluationStandard": "生产区有杂物堆置扣3分",
            "standardText": "生产区有杂物堆置扣3分",
            "scoringMethod": "现场检查",
            "dataSource": "厂(站)生产区无杂物堆置",
            "options": [
              {
                "reason": "1. 生产区有杂物堆置扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "maonan_town_plant_mn_plant_020_option_1",
                "name": "1. 生产区有杂物堆置扣3分",
                "deduction": 3.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_021",
            "name": "厂(站)环境（厂(站)环境整洁）",
            "maxScore": 5.0,
            "evaluationStandard": "周围有垃圾堆放扣1分；草皮明显缺失扣1分。",
            "standardText": "周围有垃圾堆放扣1分；草皮明显缺失扣1分。",
            "scoringMethod": "现场检查",
            "dataSource": "厂(站)环境整洁，绿化达标，植物有人打理",
            "options": [
              {
                "reason": "1. 周围有垃圾堆放扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_021_option_1",
                "name": "1. 周围有垃圾堆放扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 草皮明显缺失扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_021_option_2",
                "name": "2. 草皮明显缺失扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_plant_mn_plant_022",
            "name": "工作人员",
            "maxScore": 2.0,
            "evaluationStandard": "不能满足要求的，扣2分",
            "standardText": "不能满足要求的，扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "操作人员着装整齐，文明礼貌",
            "options": [
              {
                "reason": "1. 操作人员着装不整齐或不能做到文明礼貌，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_plant_mn_plant_022_option_1",
                "name": "1. 操作人员着装不整齐或不能做到文明礼貌，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_plant_mn_plant_g08",
    "name": "茂南项目-镇街污水处理厂-社会影响",
    "children": [
      {
        "id": "maonan_town_plant_mn_plant_g08_l2",
        "name": "社会影响",
        "items": [
          {
            "id": "maonan_town_plant_mn_plant_023",
            "name": "社会影响",
            "maxScore": 5.0,
            "evaluationStandard": "被政府部门处罚扣1分；\n被社会有效投诉每次扣0.5分；\n被公众媒体有效负面报道扣0.5分",
            "standardText": "被政府部门处罚扣1分；\n被社会有效投诉每次扣0.5分；\n被公众媒体有效负面报道扣0.5分",
            "scoringMethod": "查阅记录",
            "dataSource": "不被政府部门处罚、被社会有效投诉或公众媒体有效负面报道",
            "options": [
              {
                "reason": "1. 被政府部门处罚扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_plant_mn_plant_023_option_1",
                "name": "1. 被政府部门处罚扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 被社会有效投诉每次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 10,
                "id": "maonan_town_plant_mn_plant_023_option_2",
                "name": "2. 被社会有效投诉每次扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 被公众媒体有效负面报道扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_plant_mn_plant_023_option_3",
                "name": "3. 被公众媒体有效负面报道扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  }
] as const;

export const NETWORK_STANDARDS = [
  {
    "id": "yunan_town_network_yn_network_g01",
    "name": "郁南项目-镇街污水收集管网-日常巡查",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g01_l2",
        "name": "日常巡查",
        "items": [
          {
            "id": "yunan_town_network_yn_network_001",
            "name": "巡查工作开展",
            "maxScore": 1.5,
            "evaluationStandard": "排水设施巡查未覆盖全辖区的，扣1分排水设施巡查频率低于要求的，扣1分巡查记录不符合要求的，每处扣0.5分\n排水设施巡查未覆盖全辖区的，扣1分排水设施巡查频率低于要求的，扣1分巡查记录不符合要求的，每处扣0.5分",
            "standardText": "排水设施巡查未覆盖全辖区的，扣1分排水设施巡查频率低于要求的，扣1分巡查记录不符合要求的，每处扣0.5分\n排水设施巡查未覆盖全辖区的，扣1分排水设施巡查频率低于要求的，扣1分巡查记录不符合要求的，每处扣0.5分",
            "scoringMethod": "查阅记录",
            "dataSource": "应组织对辖区内排水管道(渠箱)、检查井、泵站、压力管、倒虹管等设施定期和不定期进行巡查；巡查记录内容齐全、真实",
            "options": [
              {
                "reason": "1. 排水设施巡查未覆盖全辖区，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_001_option_1",
                "name": "1. 排水设施巡查未覆盖全辖区，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 排水设施巡查频率低于要求，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_001_option_2",
                "name": "2. 排水设施巡查频率低于要求，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "3. 巡查记录内容不齐全或不真实，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 3,
                "id": "yunan_town_network_yn_network_001_option_3",
                "name": "3. 巡查记录内容不齐全或不真实，每处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_002",
            "name": "巡查问题处理",
            "maxScore": 1.5,
            "evaluationStandard": "发现问题未及时处理的，每个问题扣0.5分；发现问题未在30分钟内上报并按应急预案处置的，扣1分；问题处理记录不符合要求的，每处扣0.5分。\n发现问题未及时处理的，每个问题扣0.5分；发现问题未在30分钟内上报并按应急预案处置的，扣1分；问题处理记录不符合要求的，每处扣0.5分。",
            "standardText": "发现问题未及时处理的，每个问题扣0.5分；发现问题未在30分钟内上报并按应急预案处置的，扣1分；问题处理记录不符合要求的，每处扣0.5分。\n发现问题未及时处理的，每个问题扣0.5分；发现问题未在30分钟内上报并按应急预案处置的，扣1分；问题处理记录不符合要求的，每处扣0.5分。",
            "scoringMethod": "查阅记录",
            "dataSource": "巡查问题应及时处理、记录；巡查问题处理记录完整、真实",
            "options": [
              {
                "reason": "1. 发现问题未及时处理的，每个问题扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "个",
                "maxInstances": 3,
                "id": "yunan_town_network_yn_network_002_option_1",
                "name": "1. 发现问题未及时处理的，每个问题扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 发现问题未在30分钟内上报并按应急预案处置的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_002_option_2",
                "name": "2. 发现问题未在30分钟内上报并按应急预案处置的，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "3. 问题处理记录不符合要求的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 3,
                "id": "yunan_town_network_yn_network_002_option_3",
                "name": "3. 问题处理记录不符合要求的，每处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g02",
    "name": "郁南项目-镇街污水收集管网-管道及附属设施运行维护质量",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g02_l2",
        "name": "管道及附属设施运行维护质量",
        "items": [
          {
            "id": "yunan_town_network_yn_network_003",
            "name": "管道",
            "maxScore": 10.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n超过主管径(渠箱)1/2的，每处扣5分；超过主管径(渠箱)1/5的，每处扣2分。\n管道(渠箱)塌陷、堵塞的，每处扣10分；管道(渠箱)破裂的，每处扣2分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n超过主管径(渠箱)1/2的，每处扣5分；超过主管径(渠箱)1/5的，每处扣2分。\n管道(渠箱)塌陷、堵塞的，每处扣10分；管道(渠箱)破裂的，每处扣2分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "管道(渠箱)积泥深度不超过主管径(渠箱高度)的1/5\n管道(渠箱)无塌陷、无变形、无堵塞",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_003_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 超过主管径(渠箱)1/2的，每处扣5分",
                "type": "fixed",
                "value": 5.0,
                "unit": "处",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_003_option_2",
                "name": "2. 超过主管径(渠箱)1/2的，每处扣5分",
                "deduction": 5.0
              },
              {
                "reason": "3. 超过主管径(渠箱)1/5的，每处扣2分",
                "type": "fixed",
                "value": 2.0,
                "unit": "处",
                "maxInstances": 5,
                "id": "yunan_town_network_yn_network_003_option_3",
                "name": "3. 超过主管径(渠箱)1/5的，每处扣2分",
                "deduction": 2.0
              },
              {
                "reason": "4. 管道(渠箱)塌陷、堵塞的，每处扣10分",
                "type": "fixed",
                "value": 10.0,
                "unit": "处",
                "maxInstances": 1,
                "id": "yunan_town_network_yn_network_003_option_4",
                "name": "4. 管道(渠箱)塌陷、堵塞的，每处扣10分",
                "deduction": 10.0
              },
              {
                "reason": "5. 管道(渠箱)破裂的，每处扣2分",
                "type": "fixed",
                "value": 2.0,
                "unit": "处",
                "maxInstances": 5,
                "id": "yunan_town_network_yn_network_003_option_5",
                "name": "5. 管道(渠箱)破裂的，每处扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_004",
            "name": "管道（管道(渠箱)无污水冒出）",
            "maxScore": 10.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n发现一处扣2分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n发现一处扣2分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "管道(渠箱)无污水冒出\n河道两侧截污管无污水渗入河水",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_004_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 发现管道（渠箱）有污水冒出或截污管污水渗入河道，每处扣2分",
                "type": "fixed",
                "value": 2.0,
                "unit": "处",
                "maxInstances": 5,
                "id": "yunan_town_network_yn_network_004_option_2",
                "name": "2. 发现管道（渠箱）有污水冒出或截污管污水渗入河道，每处扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_005",
            "name": "管道（每季度维护不少于1次）",
            "maxScore": 3.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n维护频率低于要求的，扣3分；维护记录不符合要求的，扣2分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n维护频率低于要求的，扣3分；维护记录不符合要求的，扣2分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "每季度维护不少于1次",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_005_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 维护频率低于要求的，扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_network_yn_network_005_option_2",
                "name": "2. 维护频率低于要求的，扣3分",
                "deduction": 3.0
              },
              {
                "reason": "3. 维护记录不符合要求的，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_network_yn_network_005_option_3",
                "name": "3. 维护记录不符合要求的，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_006",
            "name": "管道（每2～5年对辖区内排水管道(渠箱)进行一次功能性）",
            "maxScore": 2.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n普查频率低于要求的，扣2分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n普查频率低于要求的，扣2分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "每2～5年对辖区内排水管道(渠箱)进行一次功能性和结构性状况普查",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_006_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 普查频率低于要求的，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_network_yn_network_006_option_2",
                "name": "2. 普查频率低于要求的，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_007",
            "name": "检查井",
            "maxScore": 5.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n不符合要求的，每处扣0.3分；积泥去向不明的，不得分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n不符合要求的，每处扣0.3分；积泥去向不明的，不得分。",
            "scoringMethod": "目测或尺量",
            "dataSource": "检查井积泥深度不超过：\n(1)落底井：管底以下50mm\n(2)半落底井：管径的1/5\n(3)平底井：管径的1/5\n积泥得到妥善处理。",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_007_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 检查井积泥深度超过对应井型限值，每处扣0.3分",
                "type": "fixed",
                "value": 0.3,
                "unit": "处",
                "maxInstances": 16,
                "id": "yunan_town_network_yn_network_007_option_2",
                "name": "2. 检查井积泥深度超过对应井型限值，每处扣0.3分",
                "deduction": 0.3
              },
              {
                "reason": "3. 积泥去向不明的，不得分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_007_option_3",
                "name": "3. 积泥去向不明的，不得分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_008",
            "name": "检查井（井盖(含井框)无缺失）",
            "maxScore": 3.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n缺失井盖(井框)的，每处扣3分；井盖(井框)破损超过井盖面积1/10的，每处扣0.5分；渠箱盖板缺失的，每处扣3分；渠箱盖板断裂的，每处扣0.5分",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n缺失井盖(井框)的，每处扣3分；井盖(井框)破损超过井盖面积1/10的，每处扣0.5分；渠箱盖板缺失的，每处扣3分；渠箱盖板断裂的，每处扣0.5分",
            "scoringMethod": "目测或尺量",
            "dataSource": "井盖(含井框)无缺失，破损不超过井盖面积1/10；渠箱盖板没有缺失、断裂",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_008_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 缺失井盖(井框)的，每处扣3分",
                "type": "fixed",
                "value": 3.0,
                "unit": "处",
                "maxInstances": 1,
                "id": "yunan_town_network_yn_network_008_option_2",
                "name": "2. 缺失井盖(井框)的，每处扣3分",
                "deduction": 3.0
              },
              {
                "reason": "3. 井盖(井框)破损超过井盖面积1/10的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "yunan_town_network_yn_network_008_option_3",
                "name": "3. 井盖(井框)破损超过井盖面积1/10的，每处扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "4. 渠箱盖板缺失的，每处扣3分",
                "type": "fixed",
                "value": 3.0,
                "unit": "处",
                "maxInstances": 1,
                "id": "yunan_town_network_yn_network_008_option_4",
                "name": "4. 渠箱盖板缺失的，每处扣3分",
                "deduction": 3.0
              },
              {
                "reason": "5. 渠箱盖板断裂的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "yunan_town_network_yn_network_008_option_5",
                "name": "5. 渠箱盖板断裂的，每处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_009",
            "name": "检查井（井盖没有明显跳动和声响）",
            "maxScore": 3.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "scoringMethod": "目测或尺量",
            "dataSource": "井盖没有明显跳动和声响，检查井框与路面高差在±5mm之内；渠箱相邻盖板高差不大于15mm，渠箱盖板没有明显跷动，破损面积不大于0.01m2",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_009_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 井盖跳动有声响、井框高差超限，或渠箱盖板跷动、破损超限，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "yunan_town_network_yn_network_009_option_2",
                "name": "2. 井盖跳动有声响、井框高差超限，或渠箱盖板跷动、破损超限，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_010",
            "name": "检查井（井内无硬块、杂物等）",
            "maxScore": 2.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "scoringMethod": "目测或尺量",
            "dataSource": "井内无硬块、杂物等",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_010_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 检查井内存在硬块或杂物，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_network_yn_network_010_option_2",
                "name": "2. 检查井内存在硬块或杂物，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_011",
            "name": "检查井（井壁四周清洁）",
            "maxScore": 2.0,
            "evaluationStandard": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "standardText": "以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n每发现1处扣0.5分。",
            "scoringMethod": "目测或尺量",
            "dataSource": "井壁四周清洁，无泥垢，批荡完整",
            "options": [
              {
                "reason": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_011_option_1",
                "name": "1. 以7个井段为一个管道检查单元，以200米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检5个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 井壁有泥垢、批荡不完整或四周不清洁，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_network_yn_network_011_option_2",
                "name": "2. 井壁有泥垢、批荡不完整或四周不清洁，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_012",
            "name": "倒虹管",
            "maxScore": 1.0,
            "evaluationStandard": "若有必须检查，水流不通扣1分，保护标志有缺损扣0.5分；管道内淤积等合并入管道检查评分项目。\n若有必须检查，水流不通扣1分，保护标志有缺损扣0.5分；管道内淤积等合并入管道检查评分项目。",
            "standardText": "若有必须检查，水流不通扣1分，保护标志有缺损扣0.5分；管道内淤积等合并入管道检查评分项目。\n若有必须检查，水流不通扣1分，保护标志有缺损扣0.5分；管道内淤积等合并入管道检查评分项目。",
            "scoringMethod": "目测或电视检查等",
            "dataSource": "水流通畅；通航河上设置的倒虹管保护标志字迹清晰，结构完好。",
            "options": [
              {
                "reason": "1. 水流不通扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_012_option_1",
                "name": "1. 水流不通扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 保护标志有缺损扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_network_yn_network_012_option_2",
                "name": "2. 保护标志有缺损扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 管道内淤积等合并入管道检查评分项目",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_012_option_3",
                "name": "3. 管道内淤积等合并入管道检查评分项目",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_013",
            "name": "压力管",
            "maxScore": 1.0,
            "evaluationStandard": "若有必须检查，每发现1处扣0.5分。\n若有必须检查，每发现1处扣0.5分。",
            "standardText": "若有必须检查，每发现1处扣0.5分。\n若有必须检查，每发现1处扣0.5分。",
            "scoringMethod": "目测或电视检查等",
            "dataSource": "压力管无渗漏及冒溢；透气井内无浮渣；排气阀、压力井、透气井及消能井等附属设施完好有效。",
            "options": [
              {
                "reason": "1. 压力管渗漏冒溢、透气井有浮渣，或排气阀及附属井设施失效，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_013_option_1",
                "name": "1. 压力管渗漏冒溢、透气井有浮渣，或排气阀及附属井设施失效，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g03",
    "name": "郁南项目-镇街污水收集管网-泵站运行维护质量",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g03_l2",
        "name": "泵站运行维护质量",
        "items": [
          {
            "id": "yunan_town_network_yn_network_014",
            "name": "机电设备运行状况",
            "maxScore": 3.0,
            "evaluationStandard": "每发现1处，扣0.5分。\n每发现1处，扣0.5分。",
            "standardText": "每发现1处，扣0.5分。\n每发现1处，扣0.5分。",
            "scoringMethod": "现场操作检查",
            "dataSource": "发电机机油、水、电池正常；仪表、紧固件齐备、有效；水温、震动、噪音、排烟正常；不漏水、不漏油；水闸变速箱机油、紧固件、设备震动正常；水闸启闭不抖动，不严重漏水；钢丝绳有润滑，且安全；水闸液压油量正常，不漏油；闸门启闭平衡，不漏水；自控设备、水位计、闸位计、雨量计、通讯、计算机等设备正常；水泵无异常噪音和震动，工作正常皮带机、格栅机工作正常、基本不积垃圾；",
            "options": [
              {
                "reason": "1. 机电设备未满足正常、齐备、有效、无异常噪音震动或无渗漏等运行要求，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "yunan_town_network_yn_network_014_option_1",
                "name": "1. 机电设备未满足正常、齐备、有效、无异常噪音震动或无渗漏等运行要求，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_015",
            "name": "设施维护状况",
            "maxScore": 2.0,
            "evaluationStandard": "每发现1处，扣0.5分。\n每发现1处，扣0.5分。",
            "standardText": "每发现1处，扣0.5分。\n每发现1处，扣0.5分。",
            "scoringMethod": "现场操作检查",
            "dataSource": "设备表面油漆完整钢结构设施、围栏、铁门等油漆完整（闸门除外）构筑物小面积破损修补地面上有无易滑物或油渍工作场所是否有堆放杂物通路（道）阶梯、设备内外、地板是否保持清洁墙壁、屋角有无蜘蛛网、灰尘无清扫衣服、茶杯等日用品是否乱放电风扇、抽风机、照明灯、日光灯等是否保持清洁屋内门窗、玻璃是否完整、清洁",
            "options": [
              {
                "reason": "1. 钢结构、围栏、铁门、构筑物及作业场所未满足完好、整洁等维护要求，每发现1处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 4,
                "id": "yunan_town_network_yn_network_015_option_1",
                "name": "1. 钢结构、围栏、铁门、构筑物及作业场所未满足完好、整洁等维护要求，每发现1处扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_016",
            "name": "故障率",
            "maxScore": 2.0,
            "evaluationStandard": "故障率3%~6%，扣1分；故障率6%~10%，扣2分。\n故障率3%~6%，扣1分；故障率6%~10%，扣2分。",
            "standardText": "故障率3%~6%，扣1分；故障率6%~10%，扣2分。\n故障率3%~6%，扣1分；故障率6%~10%，扣2分。",
            "scoringMethod": "查阅记录",
            "dataSource": "泵站故障率低于3%。",
            "options": [
              {
                "reason": "1. 故障率3%~6%，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_016_option_1",
                "name": "1. 故障率3%~6%，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 故障率6%~10%，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_network_yn_network_016_option_2",
                "name": "2. 故障率6%~10%，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_017",
            "name": "备件",
            "maxScore": 1.0,
            "evaluationStandard": "缺少备件扣1分。\n缺少备件扣1分。",
            "standardText": "缺少备件扣1分。\n缺少备件扣1分。",
            "scoringMethod": "现场检查",
            "dataSource": "泵站配备易损零配件。",
            "options": [
              {
                "reason": "1. 缺少备件扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_017_option_1",
                "name": "1. 缺少备件扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_018",
            "name": "运行维护记录",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣0.5分。\n缺少一项扣0.5分。",
            "standardText": "缺少一项扣0.5分。\n缺少一项扣0.5分。",
            "scoringMethod": "查阅记录",
            "dataSource": "应有完整的运行与维护记录，包含日常运行情况记录、定期维护记录、故障维修记录和巡视巡查记录。",
            "options": [
              {
                "reason": "1. 日常运行、定期维护、故障维修或巡视巡查记录每缺少一类扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_network_yn_network_018_option_1",
                "name": "1. 日常运行、定期维护、故障维修或巡视巡查记录每缺少一类扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_019",
            "name": "事故发生率",
            "maxScore": 2.0,
            "evaluationStandard": "发生重、特大事故扣2分。\n发生重、特大事故扣2分。",
            "standardText": "发生重、特大事故扣2分。\n发生重、特大事故扣2分。",
            "scoringMethod": "查阅记录",
            "dataSource": "不发生重、特大安全生产事故。",
            "options": [
              {
                "reason": "1. 发生重、特大事故扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_network_yn_network_019_option_1",
                "name": "1. 发生重、特大事故扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g04",
    "name": "郁南项目-镇街污水收集管网-设备配置",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g04_l2",
        "name": "设备配置",
        "items": [
          {
            "id": "yunan_town_network_yn_network_020",
            "name": "维护设备",
            "maxScore": 3.0,
            "evaluationStandard": "无配备扣3分\n无配备扣3分",
            "standardText": "无配备扣3分\n无配备扣3分",
            "scoringMethod": "现场检查",
            "dataSource": "全县至少配备一辆高压水冲车、一辆吸泥车等专用车辆",
            "options": [
              {
                "reason": "1. 未配备高压水冲车、吸泥车等规定的管网维护车辆，扣3分",
                "type": "fixed",
                "value": 3.0,
                "id": "yunan_town_network_yn_network_020_option_1",
                "name": "1. 未配备高压水冲车、吸泥车等规定的管网维护车辆，扣3分",
                "deduction": 3.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_021",
            "name": "维护设备（维护作业队伍配备易燃、易爆、有毒气体监测装置、防）",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣1分\n缺少一项扣1分",
            "standardText": "缺少一项扣1分\n缺少一项扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "维护作业队伍配备易燃、易爆、有毒气体监测装置、防毒面具",
            "options": [
              {
                "reason": "1. 易燃易爆或有毒气体监测装置、防毒面具每缺少一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_021_option_1",
                "name": "1. 易燃易爆或有毒气体监测装置、防毒面具每缺少一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g05",
    "name": "郁南项目-镇街污水收集管网-污泥运输与处置",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g05_l2",
        "name": "污泥运输与处置",
        "items": [
          {
            "id": "yunan_town_network_yn_network_022",
            "name": "运输",
            "maxScore": 1.0,
            "evaluationStandard": "污泥运输车辆无盖扣0.5分，车辆未清洗扣0.5分\n污泥运输车辆无盖扣0.5分，车辆未清洗扣0.5分",
            "standardText": "污泥运输车辆无盖扣0.5分，车辆未清洗扣0.5分\n污泥运输车辆无盖扣0.5分，车辆未清洗扣0.5分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥运输车辆应加盖，并定期清洗，保持整洁。在运输过程 中污泥不落地，沿途无洒落。",
            "options": [
              {
                "reason": "1. 污泥运输车辆无盖扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_network_yn_network_022_option_1",
                "name": "1. 污泥运输车辆无盖扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 车辆未清洗扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "yunan_town_network_yn_network_022_option_2",
                "name": "2. 车辆未清洗扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_023",
            "name": "安全",
            "maxScore": 1.0,
            "evaluationStandard": "无配套作业安全标志、警示灯每项扣0.5分\n无配套作业安全标志、警示灯每项扣0.5分",
            "standardText": "无配套作业安全标志、警示灯每项扣0.5分\n无配套作业安全标志、警示灯每项扣0.5分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥盛器和车辆在街道上停放应设置安全标志，夜间应悬挂警示灯。",
            "options": [
              {
                "reason": "1. 无配套作业安全标志、警示灯每项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "项",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_023_option_1",
                "name": "1. 无配套作业安全标志、警示灯每项扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_024",
            "name": "污泥处置",
            "maxScore": 1.0,
            "evaluationStandard": "污泥去向不明的，扣1分；污泥处置不满足行业部门管理要求的，扣1分\n污泥去向不明的，扣1分；污泥处置不满足行业部门管理要求的，扣1分",
            "standardText": "污泥去向不明的，扣1分；污泥处置不满足行业部门管理要求的，扣1分\n污泥去向不明的，扣1分；污泥处置不满足行业部门管理要求的，扣1分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥应送往有处置能力场所，污泥处置不得对环境造成污染。",
            "options": [
              {
                "reason": "1. 污泥去向不明的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_024_option_1",
                "name": "1. 污泥去向不明的，扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 污泥处置不满足行业部门管理要求的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_024_option_2",
                "name": "2. 污泥处置不满足行业部门管理要求的，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g06",
    "name": "郁南项目-镇街污水收集管网-事故抢修与应急预案",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g06_l2",
        "name": "事故抢修与应急预案",
        "items": [
          {
            "id": "yunan_town_network_yn_network_025",
            "name": "抢修安排",
            "maxScore": 3.0,
            "evaluationStandard": "记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分；未能按时限要求开展应急处置的，每一次扣1.5分\n记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分；未能按时限要求开展应急处置的，每一次扣1.5分",
            "standardText": "记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分；未能按时限要求开展应急处置的，每一次扣1.5分\n记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分；未能按时限要求开展应急处置的，每一次扣1.5分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "接到报障、报修电话后5分钟内下达抢修指令，处理完毕后应在一个小时内向报修人反馈处理结果，并将抢修情况进行记录。",
            "options": [
              {
                "reason": "1. 记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_025_option_1",
                "name": "1. 记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 未能按时限要求开展应急处置的，每一次扣1.5分",
                "type": "fixed",
                "value": 1.5,
                "unit": "次",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_025_option_2",
                "name": "2. 未能按时限要求开展应急处置的，每一次扣1.5分",
                "deduction": 1.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_026",
            "name": "抢修程序",
            "maxScore": 3.0,
            "evaluationStandard": "未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣1.5分；属重大事故但未及时报告的，每出现一次扣3分\n未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣1.5分；属重大事故但未及时报告的，每出现一次扣3分",
            "standardText": "未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣1.5分；属重大事故但未及时报告的，每出现一次扣3分\n未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣1.5分；属重大事故但未及时报告的，每出现一次扣3分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "在事故发生或接到报障、保修、投诉后30分钟内下达抢修任务，及时到过现场，开展围蔽、排水等应急处置，组织调查、抢修；属于重大事故的应在4小时内向行政主管部门报告。",
            "options": [
              {
                "reason": "1. 未及时安排抢修的，每出现一次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 6,
                "id": "yunan_town_network_yn_network_026_option_1",
                "name": "1. 未及时安排抢修的，每出现一次扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 未能按时限要求到场应急处置的，每出现一次扣1.5分",
                "type": "fixed",
                "value": 1.5,
                "unit": "次",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_026_option_2",
                "name": "2. 未能按时限要求到场应急处置的，每出现一次扣1.5分",
                "deduction": 1.5
              },
              {
                "reason": "3. 属重大事故但未及时报告的，每出现一次扣3分",
                "type": "fixed",
                "value": 3.0,
                "unit": "次",
                "maxInstances": 1,
                "id": "yunan_town_network_yn_network_026_option_3",
                "name": "3. 属重大事故但未及时报告的，每出现一次扣3分",
                "deduction": 3.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_027",
            "name": "突发事件应急处理",
            "maxScore": 3.0,
            "evaluationStandard": "缺一项扣1分\n缺一项扣1分",
            "standardText": "缺一项扣1分\n缺一项扣1分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "针对紧急事故(如污水管沉管、有毒有害气体或液体泄漏、突发环境污染事件等)、自然灾害或爆发大规模疫情，制订应急预案，并结合实际需要和情势变化适时修订。",
            "options": [
              {
                "reason": "1. 紧急事故、自然灾害或大规模疫情等应急预案每缺少一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_027_option_1",
                "name": "1. 紧急事故、自然灾害或大规模疫情等应急预案每缺少一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_028",
            "name": "突发事件应急处理（定期进行应急演练）",
            "maxScore": 1.0,
            "evaluationStandard": "一年内未组织演练扣1分\n一年内未组织演练扣1分",
            "standardText": "一年内未组织演练扣1分\n一年内未组织演练扣1分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "定期进行应急演练，切实提高应急处置能力",
            "options": [
              {
                "reason": "1. 一年内未组织演练扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_028_option_1",
                "name": "1. 一年内未组织演练扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g07",
    "name": "郁南项目-镇街污水收集管网-安全文明作业",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g07_l2",
        "name": "安全文明作业",
        "items": [
          {
            "id": "yunan_town_network_yn_network_029",
            "name": "培训和持证上岗",
            "maxScore": 1.0,
            "evaluationStandard": "无上岗证扣1分\n无上岗证扣1分",
            "standardText": "无上岗证扣1分\n无上岗证扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "作业人员上岗前必须经过专业安全技术培训、考核，具备下井作业资格，并掌握人工急救、防护用具、照明、通讯设备的使用方法及相关的安全知识，考核合格后持证上岗。",
            "options": [
              {
                "reason": "1. 无上岗证扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_029_option_1",
                "name": "1. 无上岗证扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_030",
            "name": "培训和持证上岗（建立作业人员个人培训档案）",
            "maxScore": 1.0,
            "evaluationStandard": "未建立个人培训档案扣1分\n未建立个人培训档案扣1分",
            "standardText": "未建立个人培训档案扣1分\n未建立个人培训档案扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "建立作业人员个人培训档案",
            "options": [
              {
                "reason": "1. 未建立个人培训档案扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_030_option_1",
                "name": "1. 未建立个人培训档案扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_031",
            "name": "培训和持证上岗（现场作业人员须穿着有标准性专用服装）",
            "maxScore": 1.0,
            "evaluationStandard": "无专用作业服装扣1分\n无专用作业服装扣1分",
            "standardText": "无专用作业服装扣1分\n无专用作业服装扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "现场作业人员须穿着有标准性专用服装",
            "options": [
              {
                "reason": "1. 无专用作业服装扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_031_option_1",
                "name": "1. 无专用作业服装扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_032",
            "name": "安全生产、文明施工",
            "maxScore": 6.0,
            "evaluationStandard": "根据随机抽查的维护作业现场情况进行综合打分\n根据随机抽查的维护作业现场情况进行综合打分",
            "standardText": "根据随机抽查的维护作业现场情况进行综合打分\n根据随机抽查的维护作业现场情况进行综合打分",
            "scoringMethod": "作业现场检查",
            "dataSource": "下井作业经过严格的审批手续，管道维护和检查严格按照现行行业标准《排水管道维护安全技术规程》的规定操作、执行。\n在征得交管部门同意后，应按预案进行道路围蔽并在路段两端设置交通警示标志；在繁华地区作业时，应指派专人指挥交通、维护现场秩序。\n作业现场、检查井及管道内严禁明火，车辆、行人不得进入作业区；作业人员须穿戴配有反光标志的安全警示服并正确佩戴和使用劳动保护用品；确需下井作业的，必须严格执行下井作业规范，作业人员下井后，井上任何时候应确保有两人监护；监护人员不得擅离职守。防毒面具应定期校验，下井作业前必须再次校验，合格后方可使用。\n检查井井盖开启之后，必须立即采取安全措施，并派人守护。\n作业所需的设备及器械应整齐摆放在围蔽区域内的指定地方。维护完成后，应及时清除障碍物和清扫干净作业区域。",
            "options": [
              {
                "reason": "1. 根据随机抽查的维护作业现场情况进行综合打分",
                "type": "range",
                "min": 0,
                "max": 6.0,
                "id": "yunan_town_network_yn_network_032_option_1",
                "name": "1. 根据随机抽查的维护作业现场情况进行综合打分",
                "value": 6.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g08",
    "name": "郁南项目-镇街污水收集管网-档案和信息管理",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g08_l2",
        "name": "档案和信息管理",
        "items": [
          {
            "id": "yunan_town_network_yn_network_033",
            "name": "管理人员",
            "maxScore": 1.0,
            "evaluationStandard": "未配备专职人员扣1分\n未配备专职人员扣1分",
            "standardText": "未配备专职人员扣1分\n未配备专职人员扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "配备专职档案资料管理人员",
            "options": [
              {
                "reason": "1. 未配备专职人员扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_033_option_1",
                "name": "1. 未配备专职人员扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_034",
            "name": "设施档案管理",
            "maxScore": 3.0,
            "evaluationStandard": "竣工技术资料缺一项扣1分\n竣工技术资料缺一项扣1分",
            "standardText": "竣工技术资料缺一项扣1分\n竣工技术资料缺一项扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "新建污水设施有完整、准确、清晰的竣工技术资料。竣工技术资料应包括工程建设文本、技术设计资料、竣工验收资料。应绘制能准确反映辖区内管网情况排水管网图。",
            "options": [
              {
                "reason": "1. 竣工技术资料缺一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_034_option_1",
                "name": "1. 竣工技术资料缺一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_035",
            "name": "档案资料管理制度",
            "maxScore": 1.0,
            "evaluationStandard": "未建立档案资料管理制度扣1分\n未建立档案资料管理制度扣1分",
            "standardText": "未建立档案资料管理制度扣1分\n未建立档案资料管理制度扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "建立健全排水管网及设施的档案资料管理制度。各项管网、设施维护台帐健全，记录详细，装订规范。",
            "options": [
              {
                "reason": "1. 未建立档案资料管理制度扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "yunan_town_network_yn_network_035_option_1",
                "name": "1. 未建立档案资料管理制度扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_036",
            "name": "运营维护台帐",
            "maxScore": 2.5,
            "evaluationStandard": "运营维护台帐缺失的扣2.5分；设施的更新、改造、补缺未及时归档的，每项扣0.5分；未对突发事故或设施严重损坏做记录，扣1.5分\n运营维护台帐缺失的扣2.5分；设施的更新、改造、补缺未及时归档的，每项扣0.5分；未对突发事故或设施严重损坏做记录，扣1.5分",
            "standardText": "运营维护台帐缺失的扣2.5分；设施的更新、改造、补缺未及时归档的，每项扣0.5分；未对突发事故或设施严重损坏做记录，扣1.5分\n运营维护台帐缺失的扣2.5分；设施的更新、改造、补缺未及时归档的，每项扣0.5分；未对突发事故或设施严重损坏做记录，扣1.5分",
            "scoringMethod": "现场检查",
            "dataSource": "排水设施的维护资料应正确、及时、清晰，排水设施的更新、改造、补缺、配套的资料应及时归档保存，对排水设施的突发事故或设施严重损坏情况必须及时做好记录，并应连同分析处理资料一起归档保存，实行计算机管理的维护资料应有纸质备份；",
            "options": [
              {
                "reason": "1. 运营维护台帐缺失的扣2.5分",
                "type": "fixed",
                "value": 2.5,
                "id": "yunan_town_network_yn_network_036_option_1",
                "name": "1. 运营维护台帐缺失的扣2.5分",
                "deduction": 2.5
              },
              {
                "reason": "2. 设施的更新、改造、补缺未及时归档的，每项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "项",
                "maxInstances": 5,
                "id": "yunan_town_network_yn_network_036_option_2",
                "name": "2. 设施的更新、改造、补缺未及时归档的，每项扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 未对突发事故或设施严重损坏做记录，扣1.5分",
                "type": "fixed",
                "value": 1.5,
                "id": "yunan_town_network_yn_network_036_option_3",
                "name": "3. 未对突发事故或设施严重损坏做记录，扣1.5分",
                "deduction": 1.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_037",
            "name": "数字化管理",
            "maxScore": 1.5,
            "evaluationStandard": "未有效运行地理信息系统和办公自动化系统的，扣1.5分\n未有效运行地理信息系统和办公自动化系统的，扣1.5分",
            "standardText": "未有效运行地理信息系统和办公自动化系统的，扣1.5分\n未有效运行地理信息系统和办公自动化系统的，扣1.5分",
            "scoringMethod": "现场检查",
            "dataSource": "建立地理信息系统和办公自动化系统对管道、泵站、污水厂等信息以及运行维护台帐等进行数字化、信息化管理，建立信息共享平台，并每年组织更新。",
            "options": [
              {
                "reason": "1. 未有效运行地理信息系统和办公自动化系统的，扣1.5分",
                "type": "fixed",
                "value": 1.5,
                "id": "yunan_town_network_yn_network_037_option_1",
                "name": "1. 未有效运行地理信息系统和办公自动化系统的，扣1.5分",
                "deduction": 1.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "yunan_town_network_yn_network_g09",
    "name": "郁南项目-镇街污水收集管网-社会服务",
    "children": [
      {
        "id": "yunan_town_network_yn_network_g09_l2",
        "name": "社会服务",
        "items": [
          {
            "id": "yunan_town_network_yn_network_038",
            "name": "投诉渠道",
            "maxScore": 2.0,
            "evaluationStandard": "无有效可用的投诉渠道扣2分\n无有效可用的投诉渠道扣2分",
            "standardText": "无有效可用的投诉渠道扣2分\n无有效可用的投诉渠道扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "污水管网维护、管理单位应向社会公布服务承诺、投诉电话和电子信箱，投诉渠道应保持24小时畅通。",
            "options": [
              {
                "reason": "1. 无有效可用的投诉渠道扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "yunan_town_network_yn_network_038_option_1",
                "name": "1. 无有效可用的投诉渠道扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "yunan_town_network_yn_network_039",
            "name": "社会影响",
            "maxScore": 5.0,
            "evaluationStandard": "被政府部门处罚扣5分；\n被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "standardText": "被政府部门处罚扣5分；\n被政府部门处罚扣5分；\n被社会有效投诉每次扣2.5分；\n被公众媒体有效负面报道扣5分",
            "scoringMethod": "现场检查",
            "dataSource": "不出现被政府部门处罚、被社会有效投诉或公众媒体有效负面报道",
            "options": [
              {
                "reason": "1. 被政府部门处罚扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_network_yn_network_039_option_1",
                "name": "1. 被政府部门处罚扣5分",
                "deduction": 5.0
              },
              {
                "reason": "2. 被社会有效投诉每次扣2.5分",
                "type": "fixed",
                "value": 2.5,
                "unit": "次",
                "maxInstances": 2,
                "id": "yunan_town_network_yn_network_039_option_2",
                "name": "2. 被社会有效投诉每次扣2.5分",
                "deduction": 2.5
              },
              {
                "reason": "3. 被公众媒体有效负面报道扣5分",
                "type": "fixed",
                "value": 5.0,
                "id": "yunan_town_network_yn_network_039_option_3",
                "name": "3. 被公众媒体有效负面报道扣5分",
                "deduction": 5.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g01",
    "name": "茂南项目-镇街污水收集管网-日常巡查",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g01_l2",
        "name": "日常巡查",
        "items": [
          {
            "id": "maonan_town_network_mn_network_001",
            "name": "巡查工作开展",
            "maxScore": 8.0,
            "evaluationStandard": "排水设施巡查未定期巡查的，扣4分巡查记录不符合要求的，扣2分\n排水设施巡查未定期巡查的，扣4分巡查记录不符合要求的，扣2分",
            "standardText": "排水设施巡查未定期巡查的，扣4分巡查记录不符合要求的，扣2分\n排水设施巡查未定期巡查的，扣4分巡查记录不符合要求的，扣2分",
            "scoringMethod": "查阅记录",
            "dataSource": "应组织对辖区内排水管道(渠箱)、检查井、泵站、压力管、倒虹管等设施定期和不定期进行巡查；巡查记录内容齐全、真实",
            "options": [
              {
                "reason": "1. 排水设施未按要求定期巡查，扣4分",
                "type": "fixed",
                "value": 4.0,
                "id": "maonan_town_network_mn_network_001_option_1",
                "name": "1. 排水设施未按要求定期巡查，扣4分",
                "deduction": 4.0
              },
              {
                "reason": "2. 巡查记录内容不齐全或不真实，扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_001_option_2",
                "name": "2. 巡查记录内容不齐全或不真实，扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_002",
            "name": "巡查问题处理",
            "maxScore": 7.0,
            "evaluationStandard": "发现问题未及时处理的，每个问题扣0.1分；问题处理记录不符合要求的，每处扣0.1分。\n发现问题未及时处理的，每个问题扣0.1分；问题处理记录不符合要求的，每处扣0.1分。",
            "standardText": "发现问题未及时处理的，每个问题扣0.1分；问题处理记录不符合要求的，每处扣0.1分。\n发现问题未及时处理的，每个问题扣0.1分；问题处理记录不符合要求的，每处扣0.1分。",
            "scoringMethod": "查阅记录",
            "dataSource": "巡查问题应及时处理、记录；巡查问题处理记录完整、真实",
            "options": [
              {
                "reason": "1. 发现问题未及时处理的，每个问题扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "个",
                "maxInstances": 69,
                "id": "maonan_town_network_mn_network_002_option_1",
                "name": "1. 发现问题未及时处理的，每个问题扣0.1分",
                "deduction": 0.1
              },
              {
                "reason": "2. 问题处理记录不符合要求的，每处扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 69,
                "id": "maonan_town_network_mn_network_002_option_2",
                "name": "2. 问题处理记录不符合要求的，每处扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g02",
    "name": "茂南项目-镇街污水收集管网-管道及附属设施运行维护质量",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g02_l2",
        "name": "管道及附属设施运行维护质量",
        "items": [
          {
            "id": "maonan_town_network_mn_network_003",
            "name": "管道",
            "maxScore": 3.0,
            "evaluationStandard": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n超过主管径(渠箱)1/2的，每处扣0.5分；超过主管径(渠箱)1/4的，每处扣0.5分。\n管道(渠箱)，每处扣1分；管道(渠箱)，每处扣1分。",
            "standardText": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n超过主管径(渠箱)1/2的，每处扣0.5分；超过主管径(渠箱)1/4的，每处扣0.5分。\n管道(渠箱)，每处扣1分；管道(渠箱)，每处扣1分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "管道(渠箱)积泥深度不超过主管径(渠箱高度)的1/5\n管道(渠箱)无塌陷、无变形、无堵塞",
            "options": [
              {
                "reason": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_003_option_1",
                "name": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 超过主管径(渠箱)1/2的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "maonan_town_network_mn_network_003_option_2",
                "name": "2. 超过主管径(渠箱)1/2的，每处扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 超过主管径(渠箱)1/4的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 6,
                "id": "maonan_town_network_mn_network_003_option_3",
                "name": "3. 超过主管径(渠箱)1/4的，每处扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "4. 管道（渠箱）存在塌陷、变形或堵塞，每处扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "处",
                "maxInstances": 3,
                "id": "maonan_town_network_mn_network_003_option_4",
                "name": "4. 管道（渠箱）存在塌陷、变形或堵塞，每处扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_004",
            "name": "管道（管道(渠箱)无污水冒出）",
            "maxScore": 4.0,
            "evaluationStandard": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n发现一处扣0.2分。",
            "standardText": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n发现一处扣0.2分。",
            "scoringMethod": "目测或电视检查或查阅资料",
            "dataSource": "管道(渠箱)无污水冒出",
            "options": [
              {
                "reason": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_004_option_1",
                "name": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 发现管道（渠箱）有污水冒出，每处扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "unit": "处",
                "maxInstances": 19,
                "id": "maonan_town_network_mn_network_004_option_2",
                "name": "2. 发现管道（渠箱）有污水冒出，每处扣0.2分",
                "deduction": 0.2
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_005",
            "name": "检查井",
            "maxScore": 4.0,
            "evaluationStandard": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n不符合要求的，每处扣0.1分。",
            "standardText": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n不符合要求的，每处扣0.1分。",
            "scoringMethod": "目测或尺量",
            "dataSource": "检查井积泥深度不超过：\n(1)落底井：管底以下100mm\n(2)半落底井：管径的1/4\n(3)平底井：管径的1/4",
            "options": [
              {
                "reason": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_005_option_1",
                "name": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 检查井积泥深度超过对应井型限值，每处扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 39,
                "id": "maonan_town_network_mn_network_005_option_2",
                "name": "2. 检查井积泥深度超过对应井型限值，每处扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_006",
            "name": "检查井（井盖(含井框)）",
            "maxScore": 4.0,
            "evaluationStandard": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n缺失井盖(井框)的，每处扣0.5分；井盖(井框)破损超过井盖面积1/10的，每处扣0.2分；渠箱盖板断裂的，每处扣0.2分",
            "standardText": "以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检\n缺失井盖(井框)的，每处扣0.5分；井盖(井框)破损超过井盖面积1/10的，每处扣0.2分；渠箱盖板断裂的，每处扣0.2分",
            "scoringMethod": "目测或尺量",
            "dataSource": "井盖(含井框)，破损不超过井盖面积1/10；渠箱盖板没有断裂",
            "options": [
              {
                "reason": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_006_option_1",
                "name": "1. 以5个井段为一个管道检查单元，以2000米为一个渠箱检查单元，整段管道(渠箱)不足以上长度的，以整段管道(渠箱)为一个检查单元，每次抽检4个管道(含渠箱）检查单元，每个单元各项检查不少于4处，不足4处的全检",
                "deduction": 1.0
              },
              {
                "reason": "2. 缺失井盖(井框)的，每处扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "处",
                "maxInstances": 8,
                "id": "maonan_town_network_mn_network_006_option_2",
                "name": "2. 缺失井盖(井框)的，每处扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 井盖(井框)破损超过井盖面积1/10的，每处扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "unit": "处",
                "maxInstances": 19,
                "id": "maonan_town_network_mn_network_006_option_3",
                "name": "3. 井盖(井框)破损超过井盖面积1/10的，每处扣0.2分",
                "deduction": 0.2
              },
              {
                "reason": "4. 渠箱盖板断裂的，每处扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "unit": "处",
                "maxInstances": 19,
                "id": "maonan_town_network_mn_network_006_option_4",
                "name": "4. 渠箱盖板断裂的，每处扣0.2分",
                "deduction": 0.2
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_007",
            "name": "倒虹管",
            "maxScore": 2.0,
            "evaluationStandard": "若有必须检查，水流不通扣0.5分，保护标志有缺损扣0.5分。\n若有必须检查，水流不通扣0.5分，保护标志有缺损扣0.5分。",
            "standardText": "若有必须检查，水流不通扣0.5分，保护标志有缺损扣0.5分。\n若有必须检查，水流不通扣0.5分，保护标志有缺损扣0.5分。",
            "scoringMethod": "目测或电视检查等",
            "dataSource": "水流通畅；通航河上设置的倒虹管保护结构完好。",
            "options": [
              {
                "reason": "1. 水流不通扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_007_option_1",
                "name": "1. 水流不通扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 保护标志有缺损扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_007_option_2",
                "name": "2. 保护标志有缺损扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_008",
            "name": "压力管",
            "maxScore": 1.0,
            "evaluationStandard": "若有必须检查，每发现1处扣0.1分。\n若有必须检查，每发现1处扣0.1分。",
            "standardText": "若有必须检查，每发现1处扣0.1分。\n若有必须检查，每发现1处扣0.1分。",
            "scoringMethod": "目测或电视检查等",
            "dataSource": "压力管无；排气阀、压力井、透气井附属设施完好有效。",
            "options": [
              {
                "reason": "1. 压力管或排气阀、压力井、透气井等附属设施不完好有效，每发现1处扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 9,
                "id": "maonan_town_network_mn_network_008_option_1",
                "name": "1. 压力管或排气阀、压力井、透气井等附属设施不完好有效，每发现1处扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g03",
    "name": "茂南项目-镇街污水收集管网-泵站运行维护质量",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g03_l2",
        "name": "泵站运行维护质量",
        "items": [
          {
            "id": "maonan_town_network_mn_network_009",
            "name": "机电设备运行状况",
            "maxScore": 3.0,
            "evaluationStandard": "每发现1处，扣0.1分。\n每发现1处，扣0.1分。",
            "standardText": "每发现1处，扣0.1分。\n每发现1处，扣0.1分。",
            "scoringMethod": "现场操作检查",
            "dataSource": "水、电池正常；仪表、紧固件齐备、有效；水泵无异常噪音和震动，工作正常皮带机、格栅机工作正常；",
            "options": [
              {
                "reason": "1. 机电设备未满足水、电池、仪表、紧固件齐备有效，或水泵、皮带机、格栅机运行正常等要求，每发现1处扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 29,
                "id": "maonan_town_network_mn_network_009_option_1",
                "name": "1. 机电设备未满足水、电池、仪表、紧固件齐备有效，或水泵、皮带机、格栅机运行正常等要求，每发现1处扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_010",
            "name": "设施维护状况",
            "maxScore": 3.0,
            "evaluationStandard": "每发现1处，扣0.1分。\n每发现1处，扣0.1分。",
            "standardText": "每发现1处，扣0.1分。\n每发现1处，扣0.1分。",
            "scoringMethod": "现场操作检查",
            "dataSource": "钢结构设施、围栏、铁门等油漆完整（闸门除外）；构筑物小面积破损修补；",
            "options": [
              {
                "reason": "1. 钢结构、围栏、铁门油漆不完整，或构筑物破损未修补，每发现1处扣0.1分",
                "type": "fixed",
                "value": 0.1,
                "unit": "处",
                "maxInstances": 29,
                "id": "maonan_town_network_mn_network_010_option_1",
                "name": "1. 钢结构、围栏、铁门油漆不完整，或构筑物破损未修补，每发现1处扣0.1分",
                "deduction": 0.1
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_011",
            "name": "故障率",
            "maxScore": 3.0,
            "evaluationStandard": "故障率3%~6%，扣0.5分；故障率6%~10%，扣1分。\n故障率3%~6%，扣0.5分；故障率6%~10%，扣1分。",
            "standardText": "故障率3%~6%，扣0.5分；故障率6%~10%，扣1分。\n故障率3%~6%，扣0.5分；故障率6%~10%，扣1分。",
            "scoringMethod": "查阅记录",
            "dataSource": "泵站故障率低于20%。",
            "options": [
              {
                "reason": "1. 故障率3%~6%，扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_011_option_1",
                "name": "1. 故障率3%~6%，扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 故障率6%~10%，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_011_option_2",
                "name": "2. 故障率6%~10%，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_012",
            "name": "运行维护记录",
            "maxScore": 5.0,
            "evaluationStandard": "缺少一项扣0.2分。\n缺少一项扣0.2分。",
            "standardText": "缺少一项扣0.2分。\n缺少一项扣0.2分。",
            "scoringMethod": "查阅记录",
            "dataSource": "应有完整的运行与维护记录，包含日常运行情况记录、定期维护记录、故障维修记录和巡视巡查记录。",
            "options": [
              {
                "reason": "1. 日常运行、定期维护、故障维修或巡视巡查记录每缺少一类扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "id": "maonan_town_network_mn_network_012_option_1",
                "name": "1. 日常运行、定期维护、故障维修或巡视巡查记录每缺少一类扣0.2分",
                "deduction": 0.2
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_013",
            "name": "事故发生率",
            "maxScore": 4.0,
            "evaluationStandard": "发生重、特大事故扣2分。\n发生重、特大事故扣2分。",
            "standardText": "发生重、特大事故扣2分。\n发生重、特大事故扣2分。",
            "scoringMethod": "查阅记录",
            "dataSource": "不发生重、特大安全生产事故。",
            "options": [
              {
                "reason": "1. 发生重、特大事故扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_013_option_1",
                "name": "1. 发生重、特大事故扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g04",
    "name": "茂南项目-镇街污水收集管网-设备配置",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g04_l2",
        "name": "设备配置",
        "items": [
          {
            "id": "maonan_town_network_mn_network_014",
            "name": "维护设备",
            "maxScore": 4.0,
            "evaluationStandard": "未配置检修工具的扣1分\n未配置检修工具的扣1分",
            "standardText": "未配置检修工具的扣1分\n未配置检修工具的扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "全区应配备检修工具",
            "options": [
              {
                "reason": "1. 未配置检修工具的扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_014_option_1",
                "name": "1. 未配置检修工具的扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_015",
            "name": "维护设备（维护作业队伍配备易燃、易爆、防毒面具）",
            "maxScore": 2.0,
            "evaluationStandard": "缺少一项扣1分\n缺少一项扣1分",
            "standardText": "缺少一项扣1分\n缺少一项扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "维护作业队伍配备易燃、易爆、防毒面具",
            "options": [
              {
                "reason": "1. 易燃易爆防护用品或防毒面具每缺少一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_015_option_1",
                "name": "1. 易燃易爆防护用品或防毒面具每缺少一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g05",
    "name": "茂南项目-镇街污水收集管网-污泥运输与处置",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g05_l2",
        "name": "污泥运输与处置",
        "items": [
          {
            "id": "maonan_town_network_mn_network_016",
            "name": "运输",
            "maxScore": 3.0,
            "evaluationStandard": "污泥运输车辆无盖扣1分，车辆未清洗扣1分\n污泥运输车辆无盖扣1分，车辆未清洗扣1分",
            "standardText": "污泥运输车辆无盖扣1分，车辆未清洗扣1分\n污泥运输车辆无盖扣1分，车辆未清洗扣1分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥运输车辆应加盖，并定期清洗，保持整洁。",
            "options": [
              {
                "reason": "1. 污泥运输车辆无盖扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_016_option_1",
                "name": "1. 污泥运输车辆无盖扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 车辆未清洗扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_016_option_2",
                "name": "2. 车辆未清洗扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_017",
            "name": "安全",
            "maxScore": 3.0,
            "evaluationStandard": "无配套作业安全标志、警示灯每项扣1分\n无配套作业安全标志、警示灯每项扣1分",
            "standardText": "无配套作业安全标志、警示灯每项扣1分\n无配套作业安全标志、警示灯每项扣1分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥盛器和车辆在街道上停放应设置安全标志，夜间应悬挂警示灯。",
            "options": [
              {
                "reason": "1. 无配套作业安全标志、警示灯每项扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "项",
                "maxInstances": 3,
                "id": "maonan_town_network_mn_network_017_option_1",
                "name": "1. 无配套作业安全标志、警示灯每项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_018",
            "name": "污泥处置",
            "maxScore": 2.0,
            "evaluationStandard": "污泥去向不明的，扣0.5分；污泥处置不满足行业部门管理要求的，扣0.5分\n污泥去向不明的，扣0.5分；污泥处置不满足行业部门管理要求的，扣0.5分",
            "standardText": "污泥去向不明的，扣0.5分；污泥处置不满足行业部门管理要求的，扣0.5分\n污泥去向不明的，扣0.5分；污泥处置不满足行业部门管理要求的，扣0.5分",
            "scoringMethod": "作业现场检查",
            "dataSource": "污泥应送往有处置能力场所。",
            "options": [
              {
                "reason": "1. 污泥去向不明的，扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_018_option_1",
                "name": "1. 污泥去向不明的，扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 污泥处置不满足行业部门管理要求的，扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_018_option_2",
                "name": "2. 污泥处置不满足行业部门管理要求的，扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g06",
    "name": "茂南项目-镇街污水收集管网-事故抢修与应急预案",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g06_l2",
        "name": "事故抢修与应急预案",
        "items": [
          {
            "id": "maonan_town_network_mn_network_019",
            "name": "抢修安排",
            "maxScore": 3.0,
            "evaluationStandard": "记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分；未能按时限要求开展应急处置的，每一次扣0.5分\n记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分；未能按时限要求开展应急处置的，每一次扣0.5分",
            "standardText": "记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分；未能按时限要求开展应急处置的，每一次扣0.5分\n记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分；未能按时限要求开展应急处置的，每一次扣0.5分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "接到报障、报修电话后50分钟内下达抢修指令，处理完毕后应在一个小时内向报修人反馈处理结果，并将抢修情况进行记录。",
            "options": [
              {
                "reason": "1. 记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_019_option_1",
                "name": "1. 记录须做到完整清晰(应包含接报时间、报修内容、处理人员、处理完毕时间、反馈结果等内容)，缺一项扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 未能按时限要求开展应急处置的，每一次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 6,
                "id": "maonan_town_network_mn_network_019_option_2",
                "name": "2. 未能按时限要求开展应急处置的，每一次扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_020",
            "name": "抢修程序",
            "maxScore": 4.0,
            "evaluationStandard": "未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣0.5分；属重大事故但未及时报告的，每出现一次扣1分。\n未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣0.5分；属重大事故但未及时报告的，每出现一次扣1分。",
            "standardText": "未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣0.5分；属重大事故但未及时报告的，每出现一次扣1分。\n未及时安排抢修的，每出现一次扣0.5分；未能按时限要求到场应急处置的，每出现一次扣0.5分；属重大事故但未及时报告的，每出现一次扣1分。",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "在事故发生或接到报障、报修、投诉后50分钟内下达抢修任务，及时到达现场，开展围蔽、排水等应急处置，组织调查、抢修；属于重大事故的应在6小时内向行政主管部门报告。",
            "options": [
              {
                "reason": "1. 未及时安排抢修的，每出现一次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 8,
                "id": "maonan_town_network_mn_network_020_option_1",
                "name": "1. 未及时安排抢修的，每出现一次扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "2. 未能按时限要求到场应急处置的，每出现一次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 8,
                "id": "maonan_town_network_mn_network_020_option_2",
                "name": "2. 未能按时限要求到场应急处置的，每出现一次扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 属重大事故但未及时报告的，每出现一次扣1分",
                "type": "fixed",
                "value": 1.0,
                "unit": "次",
                "maxInstances": 4,
                "id": "maonan_town_network_mn_network_020_option_3",
                "name": "3. 属重大事故但未及时报告的，每出现一次扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_021",
            "name": "突发事件应急处理",
            "maxScore": 2.0,
            "evaluationStandard": "缺一项扣0.5分\n缺一项扣0.5分",
            "standardText": "缺一项扣0.5分\n缺一项扣0.5分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "针对紧急事故(如污水管沉管、有毒有害气体或液体泄漏、突发环境污染事件等)、自然灾害或爆发大规模疫情，制定应急预案，并结合实际需要和情势变化适时修订。",
            "options": [
              {
                "reason": "1. 紧急事故、自然灾害或大规模疫情等应急预案每缺少一项扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_021_option_1",
                "name": "1. 紧急事故、自然灾害或大规模疫情等应急预案每缺少一项扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_022",
            "name": "突发事件应急处理（定期进行应急演练）",
            "maxScore": 2.0,
            "evaluationStandard": "一年内未组织演练扣2分\n一年内未组织演练扣2分",
            "standardText": "一年内未组织演练扣2分\n一年内未组织演练扣2分",
            "scoringMethod": "查阅主管部门和维管部门记录",
            "dataSource": "定期进行应急演练，切实提高应急处置能力",
            "options": [
              {
                "reason": "1. 一年内未组织演练扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_022_option_1",
                "name": "1. 一年内未组织演练扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g07",
    "name": "茂南项目-镇街污水收集管网-安全文明作业",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g07_l2",
        "name": "安全文明作业",
        "items": [
          {
            "id": "maonan_town_network_mn_network_023",
            "name": "培训和持证上岗",
            "maxScore": 3.0,
            "evaluationStandard": "无上岗证扣1分\n无上岗证扣1分",
            "standardText": "无上岗证扣1分\n无上岗证扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "作业人员上岗前必须经过专业安全技术培训、考核，具备下井作业资格，并掌握人工急救、防护用具、照明、通讯设备的使用方法及相关的安全知识，考核合格后持证上岗。",
            "options": [
              {
                "reason": "1. 无上岗证扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_023_option_1",
                "name": "1. 无上岗证扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_024",
            "name": "培训和持证上岗（建立作业人员个人培训档案）",
            "maxScore": 2.0,
            "evaluationStandard": "未建立个人培训档案扣1分\n未建立个人培训档案扣1分",
            "standardText": "未建立个人培训档案扣1分\n未建立个人培训档案扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "建立作业人员个人培训档案",
            "options": [
              {
                "reason": "1. 未建立个人培训档案扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_024_option_1",
                "name": "1. 未建立个人培训档案扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_025",
            "name": "培训和持证上岗（现场作业人员须穿着有标准性专用服装）",
            "maxScore": 2.0,
            "evaluationStandard": "无专用作业服装扣1分\n无专用作业服装扣1分",
            "standardText": "无专用作业服装扣1分\n无专用作业服装扣1分",
            "scoringMethod": "查阅资料",
            "dataSource": "现场作业人员须穿着有标准性专用服装",
            "options": [
              {
                "reason": "1. 无专用作业服装扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_025_option_1",
                "name": "1. 无专用作业服装扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_026",
            "name": "安全生产、文明施工",
            "maxScore": 3.0,
            "evaluationStandard": "根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分。\n根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分。",
            "standardText": "根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分。\n根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分。",
            "scoringMethod": "作业现场检查",
            "dataSource": "下井作业经过严格的审批手续，管道维护和检查严格按照现行行业标准《排水管道维护安全技术规程》的规定操作、执行。",
            "options": [
              {
                "reason": "1. 根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分",
                "type": "fixed",
                "value": 0.2,
                "id": "maonan_town_network_mn_network_026_option_1",
                "name": "1. 根据随机抽查的维护作业现场情况进行打分，每出现一项不符合规定的，扣0.2分",
                "deduction": 0.2
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g08",
    "name": "茂南项目-镇街污水收集管网-档案和信息管理",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g08_l2",
        "name": "档案和信息管理",
        "items": [
          {
            "id": "maonan_town_network_mn_network_027",
            "name": "管理人员",
            "maxScore": 3.0,
            "evaluationStandard": "未配备专职人员扣1分\n未配备专职人员扣1分",
            "standardText": "未配备专职人员扣1分\n未配备专职人员扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "配备专职档案资料管理人员",
            "options": [
              {
                "reason": "1. 未配备专职人员扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_027_option_1",
                "name": "1. 未配备专职人员扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_028",
            "name": "设施档案管理",
            "maxScore": 2.0,
            "evaluationStandard": "竣工技术资料缺一项扣1分\n竣工技术资料缺一项扣1分",
            "standardText": "竣工技术资料缺一项扣1分\n竣工技术资料缺一项扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "新建污水设施有完整的竣工技术资料。竣工技术资料应包括工程建设文本、技术设计资料、竣工验收资料。",
            "options": [
              {
                "reason": "1. 竣工技术资料缺一项扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_028_option_1",
                "name": "1. 竣工技术资料缺一项扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_029",
            "name": "档案资料管理制度",
            "maxScore": 2.0,
            "evaluationStandard": "未建立档案资料管理制度扣2分\n未建立档案资料管理制度扣2分",
            "standardText": "未建立档案资料管理制度扣2分\n未建立档案资料管理制度扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "建立健全排水管网及设施的档案资料管理制度。各项管网、设施维护台账健全，记录详细，装订规范。",
            "options": [
              {
                "reason": "1. 未建立档案资料管理制度扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_029_option_1",
                "name": "1. 未建立档案资料管理制度扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_030",
            "name": "运营维护台账",
            "maxScore": 2.0,
            "evaluationStandard": "未按要求建立运营维护台账的扣2分；\n未按要求建立运营维护台账的扣2分；",
            "standardText": "未按要求建立运营维护台账的扣2分；\n未按要求建立运营维护台账的扣2分；",
            "scoringMethod": "现场检查",
            "dataSource": "排水设施的维护资料应正确、及时配套的资料应及时归档保存，实行计算机管理的维护资料应有纸质备份；",
            "options": [
              {
                "reason": "1. 未按要求建立运营维护台账的扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_030_option_1",
                "name": "1. 未按要求建立运营维护台账的扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_031",
            "name": "数字化管理",
            "maxScore": 1.0,
            "evaluationStandard": "未有效运行办公自动化系统的，扣1分\n未有效运行办公自动化系统的，扣1分",
            "standardText": "未有效运行办公自动化系统的，扣1分\n未有效运行办公自动化系统的，扣1分",
            "scoringMethod": "现场检查",
            "dataSource": "建立办公自动化系统对管道、泵站、污水厂等信息以及运行维护台账等进行数字化、信息化管理，并每年组织更新。",
            "options": [
              {
                "reason": "1. 未有效运行办公自动化系统的，扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_031_option_1",
                "name": "1. 未有效运行办公自动化系统的，扣1分",
                "deduction": 1.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  },
  {
    "id": "maonan_town_network_mn_network_g09",
    "name": "茂南项目-镇街污水收集管网-社会服务",
    "children": [
      {
        "id": "maonan_town_network_mn_network_g09_l2",
        "name": "社会服务",
        "items": [
          {
            "id": "maonan_town_network_mn_network_032",
            "name": "投诉渠道",
            "maxScore": 2.0,
            "evaluationStandard": "无有效可用的投诉渠道扣2分\n无有效可用的投诉渠道扣2分",
            "standardText": "无有效可用的投诉渠道扣2分\n无有效可用的投诉渠道扣2分",
            "scoringMethod": "现场检查",
            "dataSource": "管理单位应向社会公布服务承诺、投诉电话和电子信箱，投诉渠道应保持24小时畅通。",
            "options": [
              {
                "reason": "1. 无有效可用的投诉渠道扣2分",
                "type": "fixed",
                "value": 2.0,
                "id": "maonan_town_network_mn_network_032_option_1",
                "name": "1. 无有效可用的投诉渠道扣2分",
                "deduction": 2.0
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          },
          {
            "id": "maonan_town_network_mn_network_033",
            "name": "社会影响",
            "maxScore": 2.0,
            "evaluationStandard": "被政府部门处罚扣1分；\n被政府部门处罚扣1分；\n被社会有效投诉每次扣0.5分；\n被公众媒体有效负面报道扣0.5分",
            "standardText": "被政府部门处罚扣1分；\n被政府部门处罚扣1分；\n被社会有效投诉每次扣0.5分；\n被公众媒体有效负面报道扣0.5分",
            "scoringMethod": "现场检查",
            "dataSource": "不出现被政府部门处罚、被社会有效投诉或公众媒体有效负面报道",
            "options": [
              {
                "reason": "1. 被政府部门处罚扣1分",
                "type": "fixed",
                "value": 1.0,
                "id": "maonan_town_network_mn_network_033_option_1",
                "name": "1. 被政府部门处罚扣1分",
                "deduction": 1.0
              },
              {
                "reason": "2. 被社会有效投诉每次扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "unit": "次",
                "maxInstances": 4,
                "id": "maonan_town_network_mn_network_033_option_2",
                "name": "2. 被社会有效投诉每次扣0.5分",
                "deduction": 0.5
              },
              {
                "reason": "3. 被公众媒体有效负面报道扣0.5分",
                "type": "fixed",
                "value": 0.5,
                "id": "maonan_town_network_mn_network_033_option_3",
                "name": "3. 被公众媒体有效负面报道扣0.5分",
                "deduction": 0.5
              }
            ],
            "calculationMethod": "按本指标满分和已确认扣分项计算，扣分以本项满分为上限。"
          }
        ]
      }
    ],
    "icon": "?"
  }
] as const;
